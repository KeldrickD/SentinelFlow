// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDecisionJournal {
    function logDecision(
        bytes32 decisionId,
        bytes32 policyId,
        string calldata signalType,
        int256 signalValue,
        string calldata actionType,
        bool success,
        string calldata reason
    ) external;
}
