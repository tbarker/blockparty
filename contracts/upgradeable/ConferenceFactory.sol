// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ConferenceUpgradeable.sol";

/**
 * @title ConferenceFactory
 * @dev Factory contract that deploys Conference instances as beacon proxies.
 * 
 * Architecture:
 * - UpgradeableBeacon: Holds the implementation address, can be upgraded by factory owner
 * - BeaconProxy: Each conference is a lightweight proxy that delegates to the beacon's implementation
 * 
 * Benefits:
 * - Gas efficient: Deploying a new conference only deploys a minimal proxy (~45 bytes)
 * - Upgradeable: All conferences can be upgraded atomically by upgrading the beacon
 * - Separation of concerns: Factory owner controls upgrades, conference owners control their events
 * 
 * Security:
 * - Implementation contract has _disableInitializers() in constructor to prevent takeover
 * - Each proxy is initialized exactly once during creation
 * - Only factory owner can upgrade the implementation
 */
contract ConferenceFactory is Ownable {
    /// @notice The beacon that points to the Conference implementation
    UpgradeableBeacon public immutable beacon;
    
    /// @notice Array of all deployed conference proxies
    address[] public conferences;
    
    /// @notice Mapping to check if an address is a deployed conference
    mapping(address => bool) public isConference;
    
    /// @notice Emitted when a new conference proxy is created
    event ConferenceCreated(
        address indexed conferenceProxy,
        address indexed owner,
        string name,
        uint256 deposit,
        uint256 limitOfParticipants
    );
    
    /// @notice Emitted when the implementation is upgraded
    event ImplementationUpgraded(address indexed oldImplementation, address indexed newImplementation);

    /**
     * @dev Constructor deploys the implementation and beacon.
     * @param initialOwner The owner of the factory (can upgrade implementation)
     */
    constructor(address initialOwner) Ownable(initialOwner) {
        // Deploy the implementation contract
        ConferenceUpgradeable impl = new ConferenceUpgradeable();
        
        // Deploy the beacon pointing to the implementation
        // The factory becomes the beacon owner (can upgrade)
        beacon = new UpgradeableBeacon(address(impl), address(this));
    }

    /**
     * @dev Creates a new Conference as a beacon proxy.
     * @param _name The name of the event
     * @param _deposit The amount each participant deposits (0 for default 0.02 ETH)
     * @param _limitOfParticipants The max participants (0 for default 20)
     * @param _coolingPeriod Time before owner can claim unclaimed deposits (0 for default 1 week)
     * @param _encryption Public key for encrypting participant data
     * @return proxy The address of the newly created conference proxy
     */
    function createConference(
        string memory _name,
        uint256 _deposit,
        uint256 _limitOfParticipants,
        uint256 _coolingPeriod,
        string memory _encryption
    ) external returns (address proxy) {
        // Encode the initialization call
        bytes memory initData = abi.encodeWithSelector(
            ConferenceUpgradeable.initialize.selector,
            _name,
            _deposit,
            _limitOfParticipants,
            _coolingPeriod,
            _encryption,
            payable(msg.sender) // Conference owner is the caller
        );
        
        // Deploy the beacon proxy and initialize it
        BeaconProxy beaconProxy = new BeaconProxy(address(beacon), initData);
        proxy = address(beaconProxy);
        
        // Track the deployed conference
        conferences.push(proxy);
        isConference[proxy] = true;
        
        emit ConferenceCreated(
            proxy,
            msg.sender,
            _name,
            _deposit,
            _limitOfParticipants
        );
    }

    /**
     * @dev Creates a new Conference with deterministic address using CREATE2.
     * @param _name The name of the event
     * @param _deposit The amount each participant deposits
     * @param _limitOfParticipants The max participants
     * @param _coolingPeriod Time before owner can claim unclaimed deposits
     * @param _encryption Public key for encrypting participant data
     * @param salt Unique salt for deterministic address generation
     * @return proxy The address of the newly created conference proxy
     */
    function createConferenceDeterministic(
        string memory _name,
        uint256 _deposit,
        uint256 _limitOfParticipants,
        uint256 _coolingPeriod,
        string memory _encryption,
        bytes32 salt
    ) external returns (address proxy) {
        bytes memory initData = abi.encodeWithSelector(
            ConferenceUpgradeable.initialize.selector,
            _name,
            _deposit,
            _limitOfParticipants,
            _coolingPeriod,
            _encryption,
            payable(msg.sender)
        );
        
        // Deploy with CREATE2 for deterministic address
        BeaconProxy beaconProxy = new BeaconProxy{salt: salt}(address(beacon), initData);
        proxy = address(beaconProxy);
        
        conferences.push(proxy);
        isConference[proxy] = true;
        
        emit ConferenceCreated(
            proxy,
            msg.sender,
            _name,
            _deposit,
            _limitOfParticipants
        );
    }

    /**
     * @dev Predicts the address of a conference that would be created with createConferenceDeterministic.
     * @param salt The salt that would be used for deployment
     * @param conferenceOwner The address that will own the conference
     * @param _name The name of the event
     * @param _deposit The deposit amount
     * @param _limitOfParticipants The participant limit
     * @param _coolingPeriod The cooling period
     * @param _encryption The encryption key
     * @return The predicted address
     */
    function predictConferenceAddress(
        bytes32 salt,
        address conferenceOwner,
        string memory _name,
        uint256 _deposit,
        uint256 _limitOfParticipants,
        uint256 _coolingPeriod,
        string memory _encryption
    ) external view returns (address) {
        bytes memory initData = abi.encodeWithSelector(
            ConferenceUpgradeable.initialize.selector,
            _name,
            _deposit,
            _limitOfParticipants,
            _coolingPeriod,
            _encryption,
            payable(conferenceOwner)
        );
        
        bytes memory bytecode = abi.encodePacked(
            type(BeaconProxy).creationCode,
            abi.encode(address(beacon), initData)
        );
        
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(bytecode))
        );
        
        return address(uint160(uint256(hash)));
    }

    /**
     * @dev Upgrades the implementation for ALL conferences.
     * Only callable by the factory owner.
     * @param newImplementation The address of the new implementation contract
     */
    function upgradeImplementation(address newImplementation) external onlyOwner {
        require(newImplementation != address(0), "ConferenceFactory: zero address");
        
        address oldImplementation = beacon.implementation();
        beacon.upgradeTo(newImplementation);
        
        emit ImplementationUpgraded(oldImplementation, newImplementation);
    }

    /**
     * @dev Returns the current implementation address.
     * @return The implementation contract address
     */
    function implementation() external view returns (address) {
        return beacon.implementation();
    }

    /**
     * @dev Returns the total number of deployed conferences.
     * @return The count of conferences
     */
    function conferenceCount() external view returns (uint256) {
        return conferences.length;
    }

    /**
     * @dev Returns all deployed conference addresses.
     * @return Array of conference proxy addresses
     */
    function getAllConferences() external view returns (address[] memory) {
        return conferences;
    }
}
