// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract ThemisEscrow {
    enum Status { Open, Accepted, Submitted, Disputed, Released, Refunded }

    struct Task {
        address buyer;
        address worker;
        IERC20 token;
        uint256 amount;
        bytes32 policyHash;
        bytes32 evidenceHash;
        uint64 submittedAt;
        Status status;
    }

    uint256 public nextTaskId;
    mapping(uint256 => Task) public tasks;
    address public owner;
    address public verifier;
    address public resolver;
    uint64 public immutable disputeWindow;
    bool private locked;

    event TaskCreated(uint256 indexed taskId, address indexed buyer, address token, uint256 amount, bytes32 policyHash);
    event TaskAccepted(uint256 indexed taskId, address indexed worker);
    event EvidenceSubmitted(uint256 indexed taskId, bytes32 indexed evidenceHash);
    event TaskDisputed(uint256 indexed taskId, address indexed raisedBy, bytes32 indexed reasonHash);
    event TaskSettled(uint256 indexed taskId, Status status, address recipient, uint256 amount);
    event VerifierUpdated(address indexed previousVerifier, address indexed newVerifier);
    event ResolverUpdated(address indexed previousResolver, address indexed newResolver);

    constructor(address initialVerifier, uint64 initialDisputeWindow) {
        require(initialVerifier != address(0), "VERIFIER_REQUIRED");
        require(initialDisputeWindow >= 1 hours && initialDisputeWindow <= 30 days, "INVALID_DISPUTE_WINDOW");
        owner = msg.sender;
        verifier = initialVerifier;
        resolver = msg.sender;
        disputeWindow = initialDisputeWindow;
    }

    modifier nonReentrant() {
        require(!locked, "REENTRANT");
        locked = true;
        _;
        locked = false;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "OWNER_ONLY");
        _;
    }

    function updateVerifier(address newVerifier) external onlyOwner {
        require(newVerifier != address(0), "VERIFIER_REQUIRED");
        address previousVerifier = verifier;
        verifier = newVerifier;
        emit VerifierUpdated(previousVerifier, newVerifier);
    }

    function updateResolver(address newResolver) external onlyOwner {
        require(newResolver != address(0), "RESOLVER_REQUIRED");
        address previousResolver = resolver;
        resolver = newResolver;
        emit ResolverUpdated(previousResolver, newResolver);
    }

    function createTask(IERC20 token, uint256 amount, bytes32 policyHash) external nonReentrant returns (uint256 taskId) {
        require(address(token) != address(0), "TOKEN_REQUIRED");
        require(amount > 0, "AMOUNT_REQUIRED");
        require(token.transferFrom(msg.sender, address(this), amount), "TRANSFER_FAILED");
        taskId = nextTaskId++;
        tasks[taskId] = Task(msg.sender, address(0), token, amount, policyHash, bytes32(0), 0, Status.Open);
        emit TaskCreated(taskId, msg.sender, address(token), amount, policyHash);
    }

    function acceptTask(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(task.status == Status.Open, "TASK_NOT_OPEN");
        require(msg.sender != task.buyer, "BUYER_CANNOT_WORK");
        task.worker = msg.sender;
        task.status = Status.Accepted;
        emit TaskAccepted(taskId, msg.sender);
    }

    function submitEvidence(uint256 taskId, bytes32 evidenceHash) external {
        Task storage task = tasks[taskId];
        require(task.status == Status.Accepted, "TASK_NOT_ACCEPTED");
        require(msg.sender == task.worker, "WORKER_ONLY");
        require(evidenceHash != bytes32(0), "EVIDENCE_REQUIRED");
        task.evidenceHash = evidenceHash;
        task.submittedAt = uint64(block.timestamp);
        task.status = Status.Submitted;
        emit EvidenceSubmitted(taskId, evidenceHash);
    }

    function disputeTask(uint256 taskId, bytes32 reasonHash) external {
        Task storage task = tasks[taskId];
        require(task.status == Status.Submitted, "TASK_NOT_SUBMITTED");
        require(msg.sender == task.buyer || msg.sender == task.worker, "TASK_PARTY_ONLY");
        require(block.timestamp <= uint256(task.submittedAt) + disputeWindow, "DISPUTE_WINDOW_CLOSED");
        require(reasonHash != bytes32(0), "REASON_REQUIRED");
        task.status = Status.Disputed;
        emit TaskDisputed(taskId, msg.sender, reasonHash);
    }

    function resolveDispute(uint256 taskId, bool release) external nonReentrant {
        require(msg.sender == resolver, "RESOLVER_ONLY");
        Task storage task = tasks[taskId];
        require(task.status == Status.Disputed, "TASK_NOT_DISPUTED");
        _settle(task, taskId, release);
    }

    function settle(uint256 taskId, bool release) external nonReentrant {
        Task storage task = tasks[taskId];
        require(msg.sender == task.buyer, "BUYER_ONLY");
        require(task.status == Status.Submitted, "EVIDENCE_NOT_SUBMITTED");
        require(release || block.timestamp > uint256(task.submittedAt) + disputeWindow, "REFUND_CHALLENGE_ACTIVE");
        _settle(task, taskId, release);
    }

    function settleWithReceipt(
        uint256 taskId,
        bool release,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        Task storage task = tasks[taskId];
        require(task.status == Status.Submitted, "EVIDENCE_NOT_SUBMITTED");
        require(block.timestamp <= deadline, "RECEIPT_EXPIRED");
        require(release || block.timestamp > uint256(task.submittedAt) + disputeWindow, "REFUND_CHALLENGE_ACTIVE");

        bytes32 authorizationHash = keccak256(
            abi.encode(address(this), block.chainid, taskId, task.evidenceHash, release, deadline)
        );
        require(_recoverSigner(authorizationHash, signature) == verifier, "INVALID_RECEIPT");
        _settle(task, taskId, release);
    }

    function settlementAuthorizationHash(
        uint256 taskId,
        bool release,
        uint256 deadline
    ) external view returns (bytes32) {
        Task storage task = tasks[taskId];
        return keccak256(abi.encode(address(this), block.chainid, taskId, task.evidenceHash, release, deadline));
    }

    function _settle(Task storage task, uint256 taskId, bool release) private {
        address recipient = release ? task.worker : task.buyer;
        task.status = release ? Status.Released : Status.Refunded;
        require(task.token.transfer(recipient, task.amount), "TRANSFER_FAILED");
        emit TaskSettled(taskId, task.status, recipient, task.amount);
    }

    function _recoverSigner(bytes32 messageHash, bytes calldata signature) private pure returns (address) {
        require(signature.length == 65, "INVALID_SIGNATURE_LENGTH");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "INVALID_SIGNATURE_V");
        require(uint256(s) <= 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0, "INVALID_SIGNATURE_S");
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        return ecrecover(ethSignedHash, v, r, s);
    }
}
