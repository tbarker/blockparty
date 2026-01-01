// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title OwnableUpgradeable
 * @dev Upgradeable version of Ownable contract with an owner address and basic authorization control.
 * Uses OpenZeppelin's Initializable to safely initialize in proxy context.
 */
abstract contract OwnableUpgradeable is Initializable {
    /// @custom:storage-location erc7201:blockparty.storage.OwnableUpgradeable
    struct OwnableStorage {
        address payable owner;
    }

    // keccak256(abi.encode(uint256(keccak256("blockparty.storage.OwnableUpgradeable")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant OWNABLE_STORAGE_LOCATION = 
        0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300;

    function _getOwnableStorage() private pure returns (OwnableStorage storage $) {
        assembly {
            $.slot := OWNABLE_STORAGE_LOCATION
        }
    }

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     * CRITICAL: This function must be called during proxy initialization to prevent
     * uninitialized implementation attacks (like the Parity wallet hack).
     */
    function __Ownable_init() internal onlyInitializing {
        __Ownable_init_unchained(payable(msg.sender));
    }

    function __Ownable_init_unchained(address payable initialOwner) internal onlyInitializing {
        OwnableStorage storage $ = _getOwnableStorage();
        $.owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address payable) {
        OwnableStorage storage $ = _getOwnableStorage();
        return $.owner;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner(), "Ownable: caller is not the owner");
        _;
    }

    /**
     * @dev Allows the current owner to transfer control of the contract to a newOwner.
     * @param newOwner The address to transfer ownership to.
     */
    function transferOwnership(address payable newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        OwnableStorage storage $ = _getOwnableStorage();
        emit OwnershipTransferred($.owner, newOwner);
        $.owner = newOwner;
    }
}
