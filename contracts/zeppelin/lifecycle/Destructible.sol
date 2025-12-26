// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../ownership/Ownable.sol";

/**
 * @title Destructible
 * @dev Base contract that can be destroyed by owner. All funds in contract will be sent to the owner.
 * @notice selfdestruct is deprecated in Solidity 0.8.18+ but still functional. 
 * Consider using alternative patterns for new contracts.
 */
contract Destructible is Ownable {

    constructor() payable { }

    /**
     * @dev Transfers the current balance to the owner and terminates the contract.
     */
    function destroy() public onlyOwner {
        selfdestruct(owner);
    }

    function destroyAndSend(address payable _recipient) public onlyOwner {
        selfdestruct(_recipient);
    }
}
