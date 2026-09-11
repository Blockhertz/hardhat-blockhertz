// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Lock {
  uint256 public unlockTime;
  address payable public owner;

  constructor(uint256 _unlockTime) payable {
    require(
      block.timestamp < _unlockTime,
      "Unlock time must be in future"
    );
    unlockTime = _unlockTime;
    owner = payable(msg.sender);
  }

  function withdraw() public {
    require(block.timestamp >= unlockTime, "Too early");
    require(msg.sender == owner, "Not owner");
    owner.transfer(address(this).balance);
  }
}
