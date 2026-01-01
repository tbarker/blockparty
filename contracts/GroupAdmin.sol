// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GroupAdmin
 * @dev The contract allows multiple addresses to perform as admin.
 */
contract GroupAdmin is Ownable {
    event AdminGranted(address indexed grantee);
    event AdminRevoked(address indexed grantee);
    address[] public admins;

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyAdmin() {
        require(isAdmin(msg.sender), "GroupAdmin: caller is not an admin");
        _;
    }

    /**
     * @dev Grants admin right to given addresses.
     * @param newAdmins An array of addresses
     */
    function grant(address[] calldata newAdmins) public onlyOwner {
        for (uint i = 0; i < newAdmins.length; i++) {
            admins.push(newAdmins[i]);
            emit AdminGranted(newAdmins[i]);
        }
    }

    /**
     * @dev Revoke admin right from given addresses.
     * @param oldAdmins An array of addresses
     */
    function revoke(address[] calldata oldAdmins) public onlyOwner {
        for (uint oldIdx = 0; oldIdx < oldAdmins.length; oldIdx++) {
            for (uint idx = 0; idx < admins.length; idx++) {
                if (admins[idx] == oldAdmins[oldIdx]) {
                    admins[idx] = admins[admins.length - 1];
                    admins.pop();
                    emit AdminRevoked(oldAdmins[oldIdx]);
                    break;
                }
            }
        }
    }

    /**
     * @dev Returns admin addresses
     * @return Admin addresses
     */
    function getAdmins() public view returns (address[] memory) {
        return admins;
    }

    /**
     * @dev Returns number of admins.
     * @return Number of admins.
     */
    function numOfAdmins() public view returns (uint) {
        return admins.length;
    }

    /**
     * @dev Returns if the given address is admin or not.
     * @param admin An address.
     * @return True if the given address is admin.
     */
    function isAdmin(address admin) public view returns (bool) {
        if (admin == owner()) return true;

        for (uint i = 0; i < admins.length; i++) {
            if (admins[i] == admin) {
                return true;
            }
        }
        return false;
    }
}
