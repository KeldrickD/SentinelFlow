// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IOpsTarget} from "./IOpsTarget.sol";
import {IDecisionJournal} from "./IDecisionJournal.sol";

/**
 * SentinelFlowReceiver
 * - Receives CRE reports via a trusted forwarder
 * - Always logs to DecisionJournal
 * - Conditionally executes ops actions (SET_RISK_MODE, PAUSE)
 * - Enforces cooldown per policyId
 * - Uses low-level calls so ops failures don't revert the journal log
 */
contract SentinelFlowReceiver {
    error InvalidSender(address sender);

    address public immutable forwarder;
    IOpsTarget public immutable opsTarget;
    IDecisionJournal public immutable decisionJournal;

    uint256 public cooldownSeconds;
    mapping(bytes32 => uint256) public lastActionAt; // policyId => timestamp

    event CooldownUpdated(uint256 oldCooldown, uint256 newCooldown);

    constructor(
        address _forwarder,
        address _opsTarget,
        address _decisionJournal,
        uint256 _cooldownSeconds
    ) {
        forwarder = _forwarder;
        opsTarget = IOpsTarget(_opsTarget);
        decisionJournal = IDecisionJournal(_decisionJournal);
        cooldownSeconds = _cooldownSeconds;
    }

    /**
     * CRE Receiver entrypoint
     * metadata: ignored for now
     * report: abi.encode(
     *   bool setRiskMode,
     *   bytes32 decisionId,
     *   bytes32 policyId,
     *   string signalType,
     *   int256 signalValue,
     *   string actionType,
     *   bool success,
     *   string reason
     * )
     */
    function onReport(bytes calldata /*metadata*/, bytes calldata report) external {
        if (msg.sender != forwarder) revert InvalidSender(msg.sender);

        (
            bool setRiskMode,
            bytes32 decisionId,
            bytes32 policyId,
            string memory signalType,
            int256 signalValue,
            string memory actionType,
            /*bool successIn*/,
            string memory reason
        ) = abi.decode(
                report,
                (bool, bytes32, bytes32, string, int256, string, bool, string)
            );

        bool wantsAction = _isAction(actionType);
        bool cooldownOk = _cooldownOk(policyId);

        // Default: do not execute
        bool executed = false;
        bool execSuccess = true;
        string memory actionLogged = actionType;
        string memory reasonLogged = reason;

        if (wantsAction && !cooldownOk) {
            // Cooldown blocks the action, but we still log a decision.
            execSuccess = false;
            actionLogged = "COOLDOWN_BLOCKED";
            reasonLogged = "Cooldown active; action skipped";
        } else if (wantsAction) {
            // Execute routed action via low-level call so we can still log even if it fails.
            (executed, execSuccess, actionLogged, reasonLogged) = _executeAction(
                actionType,
                setRiskMode,
                reasonLogged
            );

            // Only update cooldown tracking if we *attempted* an action (executed == true)
            if (executed) {
                lastActionAt[policyId] = block.timestamp;
            }
        } else {
            actionLogged = "NO_ACTION";
        }

        // Always log, regardless of ops call result
        decisionJournal.logDecision(
            decisionId,
            policyId,
            signalType,
            signalValue,
            actionLogged,
            execSuccess,
            reasonLogged
        );
    }

    function _cooldownOk(bytes32 policyId) internal view returns (bool) {
        uint256 last = lastActionAt[policyId];
        if (last == 0) return true;
        return block.timestamp >= last + cooldownSeconds;
    }

    function _isAction(string memory actionType) internal pure returns (bool) {
        bytes32 a = keccak256(bytes(actionType));
        return (a == keccak256("SET_RISK_MODE") || a == keccak256("PAUSE"));
    }

    function _executeAction(
        string memory actionType,
        bool setRiskMode,
        string memory reasonIn
    )
        internal
        returns (bool executed, bool ok, string memory actionLogged, string memory reasonOut)
    {
        bytes32 a = keccak256(bytes(actionType));

        if (a == keccak256("SET_RISK_MODE")) {
            // Guard: require setRiskMode flag true (keeps backward compatibility with your report schema)
            if (!setRiskMode) {
                return (false, false, "INVALID_REPORT", "SET_RISK_MODE requested but setRiskMode flag was false");
            }

            // Hardcode risk mode to 2 for MVP; we can extend to pass the mode later if needed.
            (ok, ) = address(opsTarget).call(abi.encodeWithSelector(IOpsTarget.setRiskMode.selector, uint8(2)));
            executed = true;
            actionLogged = "SET_RISK_MODE";
            reasonOut = ok ? reasonIn : "Ops call failed: setRiskMode reverted";
            return (executed, ok, actionLogged, reasonOut);
        }

        if (a == keccak256("PAUSE")) {
            (ok, ) = address(opsTarget).call(abi.encodeWithSelector(IOpsTarget.pause.selector));
            executed = true;
            actionLogged = "PAUSE";
            reasonOut = ok ? reasonIn : "Ops call failed: pause reverted";
            return (executed, ok, actionLogged, reasonOut);
        }

        return (false, false, "UNKNOWN_ACTION", "Unknown actionType");
    }
}
