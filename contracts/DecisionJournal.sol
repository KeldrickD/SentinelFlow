// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * DecisionJournal: append-only audit log.
 * Workflow logs every evaluation (NO_ACTION included) and action outcomes.
 */
contract DecisionJournal {
    event DecisionLogged(
        bytes32 indexed decisionId,
        bytes32 indexed policyId,
        string signalType,          // e.g., "PRICE_DEVIATION_BPS"
        int256 signalValue,         // e.g., deviationBps (can be signed)
        string actionType,          // e.g., "SET_RISK_MODE", "PAUSE", "NO_ACTION"
        bool success,
        string reason,              // human-readable reason (keep short)
        uint256 timestamp
    );

    function logDecision(
        bytes32 decisionId,
        bytes32 policyId,
        string calldata signalType,
        int256 signalValue,
        string calldata actionType,
        bool success,
        string calldata reason
    ) external {
        emit DecisionLogged(
            decisionId,
            policyId,
            signalType,
            signalValue,
            actionType,
            success,
            reason,
            block.timestamp
        );
    }
}
