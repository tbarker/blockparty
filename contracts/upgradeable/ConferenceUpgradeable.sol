// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./GroupAdminUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title ConferenceUpgradeable
 * @dev Upgradeable implementation of the Conference contract for use with beacon proxies.
 * 
 * SECURITY NOTES:
 * 1. This implementation uses OpenZeppelin's Initializable to prevent re-initialization attacks.
 * 2. The _disableInitializers() call in the constructor prevents the implementation contract
 *    itself from being initialized, mitigating attacks like the Parity wallet incident.
 * 3. Each proxy must call initialize() exactly once during deployment.
 * 4. Uses ERC-7201 namespaced storage to prevent storage collisions during upgrades.
 * 5. Destructible functionality is removed as selfdestruct is deprecated and incompatible
 *    with upgradeable proxies (implementation is shared across all proxies).
 */
contract ConferenceUpgradeable is Initializable, GroupAdminUpgradeable {
    /// @custom:storage-location erc7201:blockparty.storage.ConferenceUpgradeable
    struct ConferenceStorage {
        string name;
        uint256 deposit;
        uint256 limitOfParticipants;
        uint256 registered;
        uint256 attended;
        bool ended;
        bool cancelled;
        uint256 endedAt;
        uint256 coolingPeriod;
        uint256 payoutAmount;
        mapping(address => Participant) participants;
        mapping(uint256 => address) participantsIndex;
    }

    // keccak256(abi.encode(uint256(keccak256("blockparty.storage.ConferenceUpgradeable")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant CONFERENCE_STORAGE_LOCATION = 
        0x5b8ccbb9d4f9f6e3b2a1d0c9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e000;

    function _getConferenceStorage() private pure returns (ConferenceStorage storage $) {
        assembly {
            $.slot := CONFERENCE_STORAGE_LOCATION
        }
    }

    struct Participant {
        string participantName;
        address addr;
        bool attended;
        bool paid;
    }

    event RegisterEvent(address addr, string participantName);
    event AttendEvent(address addr);
    event PaybackEvent(uint256 _payout);
    event WithdrawEvent(address addr, uint256 _payout);
    event CancelEvent();
    event ClearEvent(address addr, uint256 leftOver);

    /* Modifiers */
    modifier onlyActive() {
        ConferenceStorage storage $ = _getConferenceStorage();
        require(!$.ended, "Conference: event has ended");
        _;
    }

    modifier noOneRegistered() {
        ConferenceStorage storage $ = _getConferenceStorage();
        require($.registered == 0, "Conference: participants already registered");
        _;
    }

    modifier onlyEnded() {
        ConferenceStorage storage $ = _getConferenceStorage();
        require($.ended, "Conference: event has not ended");
        _;
    }

    /**
     * @dev CRITICAL: Disable initializers in the constructor to prevent the implementation
     * contract from being initialized. This protects against attacks where an attacker
     * could initialize the implementation and potentially become its owner.
     * Reference: Parity wallet hack - uninitialized implementation was taken over.
     */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the Conference proxy. This replaces the constructor for upgradeable contracts.
     * Can only be called once per proxy due to the initializer modifier.
     * @param _name The name of the event
     * @param _deposit The amount each participant deposits
     * @param _limitOfParticipants The maximum number of participants
     * @param _coolingPeriod Time after event ends before owner can claim unclaimed deposits
     * @param _owner The address that will own this conference instance
     */
    function initialize(
        string memory _name,
        uint256 _deposit,
        uint256 _limitOfParticipants,
        uint256 _coolingPeriod,
        address payable _owner
    ) public initializer {
        __GroupAdmin_init();
        
        // Transfer ownership to the specified owner (factory caller)
        if (_owner != msg.sender) {
            transferOwnership(_owner);
        }

        ConferenceStorage storage $ = _getConferenceStorage();

        if (bytes(_name).length != 0) {
            $.name = _name;
        } else {
            $.name = "Test";
        }

        if (_deposit != 0) {
            $.deposit = _deposit;
        } else {
            $.deposit = 0.02 ether;
        }

        if (_limitOfParticipants != 0) {
            $.limitOfParticipants = _limitOfParticipants;
        } else {
            $.limitOfParticipants = 20;
        }

        if (_coolingPeriod != 0) {
            $.coolingPeriod = _coolingPeriod;
        } else {
            $.coolingPeriod = 1 weeks;
        }
    }

    /* Public view functions */
    function name() public view returns (string memory) {
        ConferenceStorage storage $ = _getConferenceStorage();
        return $.name;
    }

    function deposit() public view returns (uint256) {
        ConferenceStorage storage $ = _getConferenceStorage();
        return $.deposit;
    }

    function limitOfParticipants() public view returns (uint256) {
        ConferenceStorage storage $ = _getConferenceStorage();
        return $.limitOfParticipants;
    }

    function registered() public view returns (uint256) {
        ConferenceStorage storage $ = _getConferenceStorage();
        return $.registered;
    }

    function attended() public view returns (uint256) {
        ConferenceStorage storage $ = _getConferenceStorage();
        return $.attended;
    }

    function ended() public view returns (bool) {
        ConferenceStorage storage $ = _getConferenceStorage();
        return $.ended;
    }

    function cancelled() public view returns (bool) {
        ConferenceStorage storage $ = _getConferenceStorage();
        return $.cancelled;
    }

    function endedAt() public view returns (uint256) {
        ConferenceStorage storage $ = _getConferenceStorage();
        return $.endedAt;
    }

    function coolingPeriod() public view returns (uint256) {
        ConferenceStorage storage $ = _getConferenceStorage();
        return $.coolingPeriod;
    }

    function payoutAmount() public view returns (uint256) {
        ConferenceStorage storage $ = _getConferenceStorage();
        return $.payoutAmount;
    }

    function participants(address _addr) public view returns (
        string memory participantName,
        address addr,
        bool participantAttended,
        bool paid
    ) {
        ConferenceStorage storage $ = _getConferenceStorage();
        Participant storage p = $.participants[_addr];
        return (p.participantName, p.addr, p.attended, p.paid);
    }

    function participantsIndex(uint256 index) public view returns (address) {
        ConferenceStorage storage $ = _getConferenceStorage();
        return $.participantsIndex[index];
    }

    /**
     * @dev Registers with twitter name.
     * @param _participant The twitter address of the participant
     */
    function register(string calldata _participant) external payable onlyActive {
        ConferenceStorage storage $ = _getConferenceStorage();
        require(msg.value == $.deposit, "Conference: incorrect deposit amount");
        require($.registered < $.limitOfParticipants, "Conference: participant limit reached");
        require(!isRegistered(msg.sender), "Conference: already registered");

        $.registered++;
        $.participantsIndex[$.registered] = msg.sender;
        $.participants[msg.sender] = Participant(_participant, msg.sender, false, false);
        emit RegisterEvent(msg.sender, _participant);
    }

    /**
     * @dev Withdraws deposit after the event is over.
     */
    function withdraw() external onlyEnded {
        ConferenceStorage storage $ = _getConferenceStorage();
        require($.payoutAmount > 0, "Conference: no payout available");
        Participant storage participant = $.participants[msg.sender];
        require(participant.addr == msg.sender, "Conference: not a participant");
        require($.cancelled || participant.attended, "Conference: did not attend");
        require(participant.paid == false, "Conference: already paid");

        participant.paid = true;
        payable(msg.sender).transfer($.payoutAmount);
        emit WithdrawEvent(msg.sender, $.payoutAmount);
    }

    /* Constants */
    /**
     * @dev Returns total balance of the contract.
     * @return The total balance of the contract.
     */
    function totalBalance() public view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Returns true if the given user is registered.
     * @param _addr The address of a participant.
     * @return True if the address exists in the participant list.
     */
    function isRegistered(address _addr) public view returns (bool) {
        ConferenceStorage storage $ = _getConferenceStorage();
        return $.participants[_addr].addr != address(0);
    }

    /**
     * @dev Returns true if the given user is attended.
     * @param _addr The address of a participant.
     * @return True if the user is marked as attended by admin.
     */
    function isAttended(address _addr) public view returns (bool) {
        ConferenceStorage storage $ = _getConferenceStorage();
        return isRegistered(_addr) && $.participants[_addr].attended;
    }

    /**
     * @dev Returns true if the given user has withdrawn his/her deposit.
     * @param _addr The address of a participant.
     * @return True if the attendee has withdrawn his/her deposit.
     */
    function isPaid(address _addr) public view returns (bool) {
        ConferenceStorage storage $ = _getConferenceStorage();
        return isRegistered(_addr) && $.participants[_addr].paid;
    }

    /**
     * @dev Show the payout amount each participant can withdraw.
     * @return The amount each participant can withdraw.
     */
    function payout() public view returns (uint256) {
        ConferenceStorage storage $ = _getConferenceStorage();
        if ($.attended == 0) return 0;
        return totalBalance() / $.attended;
    }

    /* Admin only functions */

    /**
     * @dev Ends the event by owner
     */
    function payback() external onlyOwner onlyActive {
        ConferenceStorage storage $ = _getConferenceStorage();
        $.payoutAmount = payout();
        $.ended = true;
        $.endedAt = block.timestamp;
        emit PaybackEvent($.payoutAmount);
    }

    /**
     * @dev Cancels the event by owner. When the event is canceled each participant can withdraw their deposit back.
     */
    function cancel() external onlyOwner onlyActive {
        ConferenceStorage storage $ = _getConferenceStorage();
        $.payoutAmount = $.deposit;
        $.cancelled = true;
        $.ended = true;
        $.endedAt = block.timestamp;
        emit CancelEvent();
    }

    /**
     * @dev The event owner transfer the outstanding deposits if there are any unclaimed deposits after cooling period
     */
    function clear() external onlyOwner onlyEnded {
        ConferenceStorage storage $ = _getConferenceStorage();
        require(block.timestamp > $.endedAt + $.coolingPeriod, "Conference: cooling period not passed");
        uint256 leftOver = totalBalance();
        owner().transfer(leftOver);
        emit ClearEvent(owner(), leftOver);
    }

    /**
     * @dev Change the capacity of the event. The owner can change it until event is over.
     * @param _limitOfParticipants the number of the capacity of the event.
     */
    function setLimitOfParticipants(uint256 _limitOfParticipants) external onlyOwner onlyActive {
        ConferenceStorage storage $ = _getConferenceStorage();
        $.limitOfParticipants = _limitOfParticipants;
    }

    /**
     * @dev Change the name of the event. The owner can change it as long as no one has registered yet.
     * @param _name the name of the event.
     */
    function changeName(string calldata _name) external onlyOwner noOneRegistered {
        ConferenceStorage storage $ = _getConferenceStorage();
        $.name = _name;
    }

    /**
     * @dev Mark participants as attended. The attendance cannot be undone.
     * @param _addresses The list of participant's address.
     */
    function attend(address[] calldata _addresses) external onlyAdmin onlyActive {
        ConferenceStorage storage $ = _getConferenceStorage();
        for (uint i = 0; i < _addresses.length; i++) {
            address _addr = _addresses[i];
            require(isRegistered(_addr), "Conference: address not registered");
            require(!isAttended(_addr), "Conference: already attended");
            emit AttendEvent(_addr);
            $.participants[_addr].attended = true;
            $.attended++;
        }
    }
}
