// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Conference} from "../contracts/Conference.sol";
import {ConferenceFactory} from "../contracts/upgradeable/ConferenceFactory.sol";
import {ConferenceUpgradeable} from "../contracts/upgradeable/ConferenceUpgradeable.sol";

/**
 * @title DeployConference
 * @dev Deploy the original non-upgradeable Conference contract (legacy)
 */
contract DeployConference is Script {
    function run() external {
        // Default configuration
        string memory name = vm.envOr("CONFERENCE_NAME", string("BlockParty"));
        uint256 deposit = vm.envOr("CONFERENCE_DEPOSIT", uint256(0.02 ether));
        uint256 limitOfParticipants = vm.envOr("CONFERENCE_LIMIT", uint256(20));
        uint256 coolingPeriod = vm.envOr("CONFERENCE_COOLING_PERIOD", uint256(1 weeks));
        string memory metadataUri = vm.envOr("METADATA_URI", string(""));

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        Conference conference = new Conference(
            name,
            deposit,
            limitOfParticipants,
            coolingPeriod,
            metadataUri
        );
        
        vm.stopBroadcast();
        
        console.log("Conference deployed at:", address(conference));
        console.log("Name:", name);
        console.log("Deposit:", deposit);
        console.log("Limit:", limitOfParticipants);
        console.log("Cooling Period:", coolingPeriod);
        console.log("Metadata URI:", metadataUri);
    }
}

/**
 * @title DeployConferenceLocal
 * @dev Deploy the original Conference for local development (legacy)
 */
contract DeployConferenceLocal is Script {
    function run() external {
        // For local development without private key
        vm.startBroadcast();
        
        Conference conference = new Conference(
            "BlockParty Local",
            0.02 ether,
            20,
            1 weeks,
            ""  // Empty metadata URI for local development
        );
        
        vm.stopBroadcast();
        
        console.log("Conference deployed at:", address(conference));
    }
}

/**
 * @title DeployConferenceFactory
 * @dev Deploy the upgradeable ConferenceFactory using Beacon Proxy pattern
 * 
 * This deploys:
 * 1. ConferenceUpgradeable implementation (protected from direct initialization)
 * 2. UpgradeableBeacon pointing to the implementation
 * 3. ConferenceFactory that owns the beacon and creates proxies
 * 
 * Usage:
 *   forge script script/Deploy.s.sol:DeployConferenceFactory --broadcast --rpc-url <RPC_URL> --private-key <KEY>
 */
contract DeployConferenceFactory is Script {
    function run() external returns (address factoryAddress) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying ConferenceFactory...");
        console.log("Factory owner will be:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        ConferenceFactory factory = new ConferenceFactory(deployer);
        
        vm.stopBroadcast();
        
        factoryAddress = address(factory);
        
        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("ConferenceFactory deployed at:", factoryAddress);
        console.log("UpgradeableBeacon deployed at:", address(factory.beacon()));
        console.log("Implementation deployed at:", factory.implementation());
        console.log("");
        console.log("Factory owner:", factory.owner());
        console.log("");
        console.log("To create a new conference, call:");
        console.log("  factory.createConference(name, deposit, limit, coolingPeriod)");
    }
}

/**
 * @title DeployConferenceFactoryLocal
 * @dev Deploy the upgradeable ConferenceFactory for local development with Anvil
 * 
 * Usage:
 *   forge script script/Deploy.s.sol:DeployConferenceFactoryLocal --broadcast --rpc-url http://localhost:8545 --sender 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
 */
contract DeployConferenceFactoryLocal is Script {
    function run() external returns (address factoryAddress, address conferenceAddress) {
        vm.startBroadcast();
        
        // Deploy factory - msg.sender becomes owner
        ConferenceFactory factory = new ConferenceFactory(msg.sender);
        factoryAddress = address(factory);
        
        // Create an initial conference for testing
        conferenceAddress = factory.createConference(
            "BlockParty Local",
            0.02 ether,
            20,
            1 weeks,
            ""  // Empty metadata URI for local development
        );
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== Local Deployment Summary ===");
        console.log("ConferenceFactory deployed at:", factoryAddress);
        console.log("UpgradeableBeacon deployed at:", address(factory.beacon()));
        console.log("Implementation deployed at:", factory.implementation());
        console.log("");
        console.log("Initial Conference (proxy) deployed at:", conferenceAddress);
        console.log("");
        console.log("Factory owner:", factory.owner());
    }
}

/**
 * @title CreateConferenceViaFactory
 * @dev Create a new conference using an existing factory
 * 
 * Environment variables:
 *   FACTORY_ADDRESS - Address of the deployed ConferenceFactory
 *   CONFERENCE_NAME - Name of the event
 *   CONFERENCE_DEPOSIT - Deposit amount in wei (default: 0.02 ether)
 *   CONFERENCE_LIMIT - Max participants (default: 20)
 *   CONFERENCE_COOLING_PERIOD - Cooling period in seconds (default: 1 week)
 *   METADATA_URI - Arweave URI for off-chain metadata (e.g., "ar://txId")
 * 
 * Usage:
 *   FACTORY_ADDRESS=0x... forge script script/Deploy.s.sol:CreateConferenceViaFactory --broadcast --rpc-url <RPC_URL> --private-key <KEY>
 */
contract CreateConferenceViaFactory is Script {
    function run() external returns (address conferenceAddress) {
        address factoryAddress = vm.envAddress("FACTORY_ADDRESS");
        string memory name = vm.envOr("CONFERENCE_NAME", string("New Event"));
        uint256 deposit = vm.envOr("CONFERENCE_DEPOSIT", uint256(0.02 ether));
        uint256 limitOfParticipants = vm.envOr("CONFERENCE_LIMIT", uint256(20));
        uint256 coolingPeriod = vm.envOr("CONFERENCE_COOLING_PERIOD", uint256(1 weeks));
        string memory metadataUri = vm.envOr("METADATA_URI", string(""));
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        ConferenceFactory factory = ConferenceFactory(factoryAddress);
        
        console.log("Creating conference via factory at:", factoryAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        conferenceAddress = factory.createConference(
            name,
            deposit,
            limitOfParticipants,
            coolingPeriod,
            metadataUri
        );
        
        vm.stopBroadcast();
        
        ConferenceUpgradeable conference = ConferenceUpgradeable(payable(conferenceAddress));
        
        console.log("");
        console.log("=== Conference Created ===");
        console.log("Conference (proxy) address:", conferenceAddress);
        console.log("Conference owner:", conference.owner());
        console.log("Name:", name);
        console.log("Deposit:", deposit);
        console.log("Limit:", limitOfParticipants);
        console.log("Cooling Period:", coolingPeriod);
        console.log("Metadata URI:", metadataUri);
    }
}

/**
 * @title UpgradeConferenceImplementation
 * @dev Upgrade all conferences to a new implementation
 * 
 * WARNING: This will upgrade ALL conferences created by the factory.
 * Make sure the new implementation is thoroughly tested!
 * 
 * Environment variables:
 *   FACTORY_ADDRESS - Address of the deployed ConferenceFactory
 *   NEW_IMPLEMENTATION - Address of the new implementation contract
 * 
 * Usage:
 *   FACTORY_ADDRESS=0x... NEW_IMPLEMENTATION=0x... forge script script/Deploy.s.sol:UpgradeConferenceImplementation --broadcast --rpc-url <RPC_URL> --private-key <KEY>
 */
contract UpgradeConferenceImplementation is Script {
    function run() external {
        address factoryAddress = vm.envAddress("FACTORY_ADDRESS");
        address newImplementation = vm.envAddress("NEW_IMPLEMENTATION");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        ConferenceFactory factory = ConferenceFactory(factoryAddress);
        address oldImplementation = factory.implementation();
        
        console.log("=== Upgrade Details ===");
        console.log("Factory address:", factoryAddress);
        console.log("Old implementation:", oldImplementation);
        console.log("New implementation:", newImplementation);
        console.log("Number of conferences affected:", factory.conferenceCount());
        
        vm.startBroadcast(deployerPrivateKey);
        
        factory.upgradeImplementation(newImplementation);
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== Upgrade Complete ===");
        console.log("All conferences now use implementation:", factory.implementation());
    }
}
