// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * MockForwarder: for tests only. Forwards onReport to the receiver so tests can simulate CRE.
 */
contract MockForwarder {
    function forward(address receiver, bytes calldata metadata, bytes calldata report) external {
        (bool success, ) = receiver.call(
            abi.encodeWithSignature("onReport(bytes,bytes)", metadata, report)
        );
        require(success, "forward failed");
    }
}
