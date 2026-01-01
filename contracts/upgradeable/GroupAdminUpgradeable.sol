// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./OwnableUpgradeable.sol";

/**
 * @title GroupAdminUpgradeable
 * @dev Upgradeable version of GroupAdmin that allows multiple addresses to perform as admin.
 */
abstract contract GroupAdminUpgradeable is OwnableUpgradeable {
    /// @custom:storage-location erc7201:blockparty.storage.GroupAdminUpgradeable
    struct GroupAdminStorage {
        address[] admins;
    }

    // keccak256(abi.encode(uint256(keccak256("blockparty.storage.GroupAdminUpgradeable")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant GROUP_ADMIN_STORAGE_LOCATION = 
        0x8a0c9d8ec1d9f8b4c7b09d5c3b0a4f0e0d1c2b3a4958697a7b8c9d0e1f203100;

    function _getGroupAdminStorage() private pure returns (GroupAdminStorage storage $) {
        assembly {
            $.slot := GROUP_ADMIN_STORAGE_LOCATION
        }
    }

    event AdminGranted(address indexed grantee);
    event AdminRevoked(address indexed grantee);

    modifier onlyAdmin() {
        require(isAdmin(msg.sender), "GroupAdmin: caller is not an admin");
        _;
    }

    /**
     * @dev Initializes the GroupAdmin. Should be called during proxy initialization.
     */
    function __GroupAdmin_init() internal onlyInitializing {
        __Ownable_init();
        __GroupAdmin_init_unchained();
    }

    function __GroupAdmin_init_unchained() internal onlyInitializing {
        // No additional initialization needed
    }

    /**
     * @dev Grants admin right to given addresses.
     * @param newAdmins An array of addresses
     */
    function grant(address[] calldata newAdmins) public onlyOwner {
        GroupAdminStorage storage $ = _getGroupAdminStorage();
        for (uint i = 0; i < newAdmins.length; i++) {
            $.admins.push(newAdmins[i]);
            emit AdminGranted(newAdmins[i]);
        }
    }

    /**
     * @dev Revoke admin right from given addresses.
     * @param oldAdmins An array of addresses
     */
    function revoke(address[] calldata oldAdmins) public onlyOwner {
        GroupAdminStorage storage $ = _getGroupAdminStorage();
        for (uint oldIdx = 0; oldIdx < oldAdmins.length; oldIdx++) {
            for (uint idx = 0; idx < $.admins.length; idx++) {
                if ($.admins[idx] == oldAdmins[oldIdx]) {
                    $.admins[idx] = $.admins[$.admins.length - 1];
                    $.admins.pop();
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
        GroupAdminStorage storage $ = _getGroupAdminStorage();
        return $.admins;
    }

    /**
     * @dev Returns number of admins.
     * @return Number of admins.
     */
    function numOfAdmins() public view returns (uint) {
        GroupAdminStorage storage $ = _getGroupAdminStorage();
        return $.admins.length;
    }

    /**
     * @dev Returns if the given address is admin or not.
     * @param admin An address.
     * @return True if the given address is admin.
     */
    function isAdmin(address admin) public view returns (bool) {
        if (admin == owner()) return true;

        GroupAdminStorage storage $ = _getGroupAdminStorage();
        for (uint i = 0; i < $.admins.length; i++) {
            if ($.admins[i] == admin) {
                return true;
            }
        }
        return false;
    }
}
