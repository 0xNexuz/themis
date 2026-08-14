// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract ThemisEscrow {
    enum Status { Open, Accepted, Submitted, Released, Refunded }

    struct Task {
        address buyer;
        address worker;
        IERC20 token;
        uint256 amount;
        bytes32 policyHash;
        bytes32 evidenceHash;
        Status status;
    }

    uint256 public nextTaskId;
    mapping(uint256 => Task) public tasks;
    bool private locked;

    event TaskCreated(uint256 indexed taskId, address indexed buyer, address token, uint256 amount, bytes32 policyHash);
    event TaskAccepted(uint256 indexed taskId, address indexed worker);
    event EvidenceSubmitted(uint256 indexed taskId, bytes32 indexed evidenceHash);
    event TaskSettled(uint256 indexed taskId, Status status, address recipient, uint256 amount);

    modifier nonReentrant() {
        require(!locked, "REENTRANT");
        locked = true;
        _;
        locked = false;
    }

    function createTask(IERC20 token, uint256 amount, bytes32 policyHash) external nonReentrant returns (uint256 taskId) {
        require(address(token) != address(0), "TOKEN_REQUIRED");
        require(amount > 0, "AMOUNT_REQUIRED");
        require(token.transferFrom(msg.sender, address(this), amount), "TRANSFER_FAILED");
        taskId = nextTaskId++;
        tasks[taskId] = Task(msg.sender, address(0), token, amount, policyHash, bytes32(0), Status.Open);
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
        task.status = Status.Submitted;
        emit EvidenceSubmitted(taskId, evidenceHash);
    }

    function settle(uint256 taskId, bool release) external nonReentrant {
        Task storage task = tasks[taskId];
        require(msg.sender == task.buyer, "BUYER_ONLY");
        require(task.status == Status.Submitted, "EVIDENCE_NOT_SUBMITTED");
        address recipient = release ? task.worker : task.buyer;
        task.status = release ? Status.Released : Status.Refunded;
        require(task.token.transfer(recipient, task.amount), "TRANSFER_FAILED");
        emit TaskSettled(taskId, task.status, recipient, task.amount);
    }
}
