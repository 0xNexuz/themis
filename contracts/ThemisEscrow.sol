// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ThemisEscrow is AccessControl, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant RECEIPT_TYPEHASH = keccak256("SettlementReceipt(uint256 taskId,address buyer,address worker,bytes32 policyHash,bytes32 evidenceHash,uint256 amount,uint8 decision,uint256 nonce,uint256 deadline)");
    enum Status { Open, Accepted, Submitted, Disputed, Released, Refunded }
    enum Decision { Release, Refund }
    struct Task { address buyer; address worker; address expectedWorker; IERC20 token; uint256 amount; bytes32 policyHash; bytes32 evidenceHash; uint64 submittedAt; Status status; }
    struct SettlementReceipt { uint256 taskId; address buyer; address worker; bytes32 policyHash; bytes32 evidenceHash; uint256 amount; Decision decision; uint256 nonce; uint256 deadline; }
    error ZeroAddress(); error InvalidAmount(); error InvalidWindow(); error InvalidState(Status expected, Status actual); error UnauthorizedWorker(); error UnauthorizedParty(); error EmptyCommitment(); error ChallengeActive(); error ChallengeClosed(); error ReceiptExpired(); error ReceiptMismatch(); error ReceiptReplay(); error InvalidVerifier();
    uint256 public nextTaskId;
    uint64 public immutable disputeWindow;
    mapping(uint256 => Task) public tasks;
    mapping(bytes32 => bool) public consumedReceipts;
    event TaskCreated(uint256 indexed taskId, address indexed buyer, address indexed expectedWorker, address token, uint256 amount, bytes32 policyHash);
    event TaskAccepted(uint256 indexed taskId, address indexed worker);
    event EvidenceSubmitted(uint256 indexed taskId, bytes32 indexed evidenceHash);
    event TaskDisputed(uint256 indexed taskId, address indexed raisedBy, bytes32 indexed reasonHash);
    event ReceiptConsumed(uint256 indexed taskId, bytes32 indexed digest, uint256 nonce);
    event TaskSettled(uint256 indexed taskId, Status status, address recipient, uint256 amount);

    constructor(address admin, address verifier, address resolver, uint64 initialDisputeWindow) EIP712("ThemisEscrow", "2") {
        if (admin == address(0) || verifier == address(0) || resolver == address(0)) revert ZeroAddress();
        if (initialDisputeWindow < 1 hours || initialDisputeWindow > 30 days) revert InvalidWindow();
        disputeWindow = initialDisputeWindow;
        _grantRole(DEFAULT_ADMIN_ROLE, admin); _grantRole(VERIFIER_ROLE, verifier); _grantRole(RESOLVER_ROLE, resolver); _grantRole(PAUSER_ROLE, admin);
    }
    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
    function createTask(IERC20 token, uint256 amount, address expectedWorker, bytes32 policyHash) external whenNotPaused nonReentrant returns (uint256 taskId) {
        if (address(token) == address(0)) revert ZeroAddress(); if (amount == 0) revert InvalidAmount(); if (policyHash == bytes32(0)) revert EmptyCommitment();
        token.safeTransferFrom(msg.sender, address(this), amount); taskId = nextTaskId++;
        tasks[taskId] = Task(msg.sender, address(0), expectedWorker, token, amount, policyHash, bytes32(0), 0, Status.Open);
        emit TaskCreated(taskId, msg.sender, expectedWorker, address(token), amount, policyHash);
    }
    function acceptTask(uint256 taskId) external whenNotPaused {
        Task storage task = tasks[taskId]; if (task.status != Status.Open) revert InvalidState(Status.Open, task.status);
        if (msg.sender == task.buyer || (task.expectedWorker != address(0) && msg.sender != task.expectedWorker)) revert UnauthorizedWorker();
        task.worker = msg.sender; task.status = Status.Accepted; emit TaskAccepted(taskId, msg.sender);
    }
    function submitEvidence(uint256 taskId, bytes32 evidenceHash) external whenNotPaused {
        Task storage task = tasks[taskId]; if (task.status != Status.Accepted) revert InvalidState(Status.Accepted, task.status); if (msg.sender != task.worker) revert UnauthorizedWorker(); if (evidenceHash == bytes32(0)) revert EmptyCommitment();
        task.evidenceHash = evidenceHash; task.submittedAt = uint64(block.timestamp); task.status = Status.Submitted; emit EvidenceSubmitted(taskId, evidenceHash);
    }
    function disputeTask(uint256 taskId, bytes32 reasonHash) external whenNotPaused {
        Task storage task = tasks[taskId]; if (task.status != Status.Submitted) revert InvalidState(Status.Submitted, task.status); if (msg.sender != task.buyer && msg.sender != task.worker) revert UnauthorizedParty(); if (block.timestamp > uint256(task.submittedAt) + disputeWindow) revert ChallengeClosed(); if (reasonHash == bytes32(0)) revert EmptyCommitment();
        task.status = Status.Disputed; emit TaskDisputed(taskId, msg.sender, reasonHash);
    }
    function resolveDispute(uint256 taskId, bool release) external onlyRole(RESOLVER_ROLE) nonReentrant { Task storage task = tasks[taskId]; if (task.status != Status.Disputed) revert InvalidState(Status.Disputed, task.status); _settle(task, taskId, release); }
    function settleWithReceipt(SettlementReceipt calldata receipt, bytes calldata signature) external whenNotPaused nonReentrant {
        Task storage task = tasks[receipt.taskId]; if (task.status != Status.Submitted) revert InvalidState(Status.Submitted, task.status); if (block.timestamp > receipt.deadline) revert ReceiptExpired();
        if (receipt.buyer != task.buyer || receipt.worker != task.worker || receipt.policyHash != task.policyHash || receipt.evidenceHash != task.evidenceHash || receipt.amount != task.amount) revert ReceiptMismatch();
        if (receipt.decision == Decision.Refund && block.timestamp <= uint256(task.submittedAt) + disputeWindow) revert ChallengeActive();
        bytes32 digest = receiptDigest(receipt); if (consumedReceipts[digest]) revert ReceiptReplay(); if (!hasRole(VERIFIER_ROLE, ECDSA.recover(digest, signature))) revert InvalidVerifier();
        consumedReceipts[digest] = true; emit ReceiptConsumed(receipt.taskId, digest, receipt.nonce); _settle(task, receipt.taskId, receipt.decision == Decision.Release);
    }
    function receiptDigest(SettlementReceipt calldata receipt) public view returns (bytes32) { return _hashTypedDataV4(keccak256(abi.encode(RECEIPT_TYPEHASH, receipt.taskId, receipt.buyer, receipt.worker, receipt.policyHash, receipt.evidenceHash, receipt.amount, receipt.decision, receipt.nonce, receipt.deadline))); }
    function _settle(Task storage task, uint256 taskId, bool release) private { address recipient = release ? task.worker : task.buyer; task.status = release ? Status.Released : Status.Refunded; task.token.safeTransfer(recipient, task.amount); emit TaskSettled(taskId, task.status, recipient, task.amount); }
}
