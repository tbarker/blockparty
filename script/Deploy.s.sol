// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/Conference.sol";

contract DeployConference is Script {
    function run() external {
        // Default configuration
        string memory name = vm.envOr("CONFERENCE_NAME", string("BlockParty"));
        uint256 deposit = vm.envOr("CONFERENCE_DEPOSIT", uint256(0.02 ether));
        uint256 limitOfParticipants = vm.envOr("CONFERENCE_LIMIT", uint256(20));
        uint256 coolingPeriod = vm.envOr("CONFERENCE_COOLING_PERIOD", uint256(1 weeks));
        string memory encryption = vm.envOr("CONFERENCE_ENCRYPTION", string(""));

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        Conference conference = new Conference(
            name,
            deposit,
            limitOfParticipants,
            coolingPeriod,
            encryption
        );
        
        vm.stopBroadcast();
        
        console.log("Conference deployed at:", address(conference));
        console.log("Name:", name);
        console.log("Deposit:", deposit);
        console.log("Limit:", limitOfParticipants);
        console.log("Cooling Period:", coolingPeriod);
    }
}

contract DeployConferenceLocal is Script {
    function run() external {
        // For local development without private key
        vm.startBroadcast();
        
        Conference conference = new Conference(
            "BlockParty Local",
            0.02 ether,
            20,
            1 weeks,
            ""
        );
        
        vm.stopBroadcast();
        
        console.log("Conference deployed at:", address(conference));
    }
}
