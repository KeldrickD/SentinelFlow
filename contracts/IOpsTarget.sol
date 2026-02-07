// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IOpsTarget {
    function pause() external;
    function setRiskMode(uint8 mode) external;
}
