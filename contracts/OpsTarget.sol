// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * OpsTarget: a demo-safe contract controlled by an authorized executor (the CRE workflow).
 * It exposes operational toggles (pause/risk mode/tx cap) and emits events for auditability.
 */
contract OpsTarget is Ownable {
    address public executor;

    bool public paused;
    uint8 public riskMode;       // 0=Normal, 1=Caution, 2=Emergency
    uint256 public maxTxCap;     // arbitrary "cap" to demonstrate ops controls

    event ExecutorUpdated(address indexed oldExecutor, address indexed newExecutor);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event RiskModeUpdated(uint8 indexed oldMode, uint8 indexed newMode, address indexed by);
    event MaxTxCapUpdated(uint256 oldCap, uint256 newCap, address indexed by);

    error NotExecutor();
    error AlreadyPaused();
    error NotPaused();
    error InvalidRiskMode();

    constructor(address initialOwner, address initialExecutor) Ownable(initialOwner) {
        executor = initialExecutor;
        emit ExecutorUpdated(address(0), initialExecutor);
    }

    modifier onlyExecutor() {
        if (msg.sender != executor) revert NotExecutor();
        _;
    }

    function setExecutor(address newExecutor) external onlyOwner {
        address old = executor;
        executor = newExecutor;
        emit ExecutorUpdated(old, newExecutor);
    }

    function pause() external onlyExecutor {
        if (paused) revert AlreadyPaused();
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyExecutor {
        if (!paused) revert NotPaused();
        paused = false;
        emit Unpaused(msg.sender);
    }

    function setRiskMode(uint8 mode) external onlyExecutor {
        if (mode > 2) revert InvalidRiskMode();
        uint8 old = riskMode;
        riskMode = mode;
        emit RiskModeUpdated(old, mode, msg.sender);
    }

    function setMaxTxCap(uint256 newCap) external onlyExecutor {
        uint256 old = maxTxCap;
        maxTxCap = newCap;
        emit MaxTxCapUpdated(old, newCap, msg.sender);
    }
}
