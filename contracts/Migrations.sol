// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Migrations {
    address public owner;
    uint public lastCompletedMigration;

    modifier restricted() {
        require(msg.sender == owner, "Migrations: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setCompleted(uint completed) public restricted {
        lastCompletedMigration = completed;
    }

    function upgrade(address newAddress) public restricted {
        Migrations upgraded = Migrations(newAddress);
        upgraded.setCompleted(lastCompletedMigration);
    }
}
