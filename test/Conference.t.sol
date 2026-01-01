// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../contracts/Conference.sol";

contract ConferenceTest is Test {
    Conference public conference;
    
    address public owner;
    address public nonOwner;
    address public attended;
    address public notAttended;
    address public notRegistered;
    address public admin;
    
    string public constant TWITTER_HANDLE = "@bighero6";
    uint256 public deposit;
    
    event RegisterEvent(address addr, string participantName);
    event AttendEvent(address addr);
    event PaybackEvent(uint256 _payout);
    event WithdrawEvent(address addr, uint256 _payout);
    event CancelEvent();
    event ClearEvent(address addr, uint256 leftOver);
    
    function setUp() public virtual {
        owner = address(this);
        nonOwner = makeAddr("nonOwner");
        attended = makeAddr("attended");
        notAttended = makeAddr("notAttended");
        notRegistered = makeAddr("notRegistered");
        admin = makeAddr("admin");
        
        // Fund test accounts
        vm.deal(owner, 100 ether);
        vm.deal(nonOwner, 100 ether);
        vm.deal(attended, 100 ether);
        vm.deal(notAttended, 100 ether);
        vm.deal(notRegistered, 100 ether);
        vm.deal(admin, 100 ether);
        
        // Deploy with default values
        conference = new Conference("", 0, 0, 0);
        deposit = conference.deposit();
    }
}

contract ConferenceChangeNameTest is ConferenceTest {
    function test_OwnerCanRenameEvent() public {
        conference.changeName("new name");
        assertEq(conference.name(), "new name");
    }
    
    function test_NonOwnerCannotRenameEvent() public {
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        conference.changeName("new name");
        assertEq(conference.name(), "Test");
    }
    
    function test_CannotRenameEventOnceRegistered() public {
        conference.register{value: deposit}(TWITTER_HANDLE);
        vm.expectRevert("Conference: participants already registered");
        conference.changeName("new name");
        assertEq(conference.name(), "Test");
    }
}

contract ConferenceLimitTest is ConferenceTest {
    function test_DoesNotAllowRegisterMoreThanLimit() public {
        conference.setLimitOfParticipants(1);
        conference.register{value: deposit}(TWITTER_HANDLE);
        assertEq(conference.registered(), 1);
        
        vm.prank(nonOwner);
        vm.expectRevert("Conference: participant limit reached");
        conference.register{value: deposit}("anotherName");
        assertEq(conference.registered(), 1);
    }
    
    function test_ReturnsOnlyYourDepositForMultipleInvalidations() public {
        conference.setLimitOfParticipants(2);
        conference.register{value: deposit}(TWITTER_HANDLE);
        
        vm.prank(nonOwner);
        conference.register{value: deposit}("anotherName");
        assertEq(conference.registered(), 2);
        
        address thirdUser = makeAddr("thirdUser");
        vm.deal(thirdUser, 100 ether);
        uint256 invalidDeposit = deposit / 2;
        
        // Contract checks deposit amount first, then participant limit
        // So with wrong deposit, it will revert with incorrect deposit amount
        vm.prank(thirdUser);
        vm.expectRevert("Conference: incorrect deposit amount");
        conference.register{value: invalidDeposit}("anotherName");
        
        assertEq(conference.registered(), 2);
        assertEq(address(conference).balance, 2 * deposit);
    }
}

contract ConferenceCreationTest is ConferenceTest {
    function test_HasDefaultValues() public view {
        assertEq(conference.name(), "Test");
        assertEq(conference.deposit(), 0.02 ether);
        assertEq(conference.limitOfParticipants(), 20);
        assertEq(conference.registered(), 0);
        assertEq(conference.attended(), 0);
        assertEq(conference.totalBalance(), 0);
    }
    
    function test_CanSetConfigValues() public {
        Conference customConference = new Conference("Test 1", 2 ether, 100, 2);
        assertEq(customConference.name(), "Test 1");
        assertEq(customConference.deposit(), 2 ether);
        assertEq(customConference.limitOfParticipants(), 100);
    }
}

contract ConferenceRegistrationTest is ConferenceTest {
    function setUp() public override {
        super.setUp();
        conference.register{value: deposit}(TWITTER_HANDLE);
    }
    
    function test_IncrementsRegistered() public view {
        assertEq(conference.registered(), 1);
    }
    
    function test_IncreasesTotalBalance() public view {
        assertEq(conference.totalBalance(), deposit);
    }
    
    function test_IsRegisteredForRegisteredAccountIsTrue() public view {
        assertTrue(conference.isRegistered(owner));
    }
    
    function test_IsRegisteredForDifferentAccountIsFalse() public view {
        assertFalse(conference.isRegistered(nonOwner));
    }
}

contract ConferenceFailedRegistrationTest is ConferenceTest {
    function test_CannotRegisterWithWrongDeposit() public {
        uint256 wrongDeposit = 5;
        uint256 beforeBalance = address(conference).balance;
        
        vm.expectRevert("Conference: incorrect deposit amount");
        conference.register{value: wrongDeposit}(TWITTER_HANDLE);
        
        assertEq(address(conference).balance, beforeBalance);
        assertFalse(conference.isRegistered(owner));
    }
    
    function test_CannotRegisterTwiceWithSameAddress() public {
        conference.register{value: deposit}(TWITTER_HANDLE);
        
        vm.expectRevert("Conference: already registered");
        conference.register{value: deposit}(TWITTER_HANDLE);
        
        assertEq(address(conference).balance, deposit);
        assertEq(conference.registered(), 1);
        assertTrue(conference.isRegistered(owner));
    }
}

contract ConferenceAttendTest is ConferenceTest {
    function setUp() public override {
        super.setUp();
        vm.prank(nonOwner);
        conference.register{value: deposit}(TWITTER_HANDLE);
    }
    
    function test_CanBeCalledByOwner() public {
        address[] memory addresses = new address[](1);
        addresses[0] = nonOwner;
        conference.attend(addresses);
        
        assertTrue(conference.isAttended(nonOwner));
        assertEq(conference.attended(), 1);
    }
    
    function test_CanBeCalledByAdmin() public {
        address[] memory grantees = new address[](1);
        grantees[0] = admin;
        conference.grant(grantees);
        
        address[] memory addresses = new address[](1);
        addresses[0] = nonOwner;
        
        vm.prank(admin);
        conference.attend(addresses);
        
        assertTrue(conference.isAttended(nonOwner));
        assertEq(conference.attended(), 1);
    }
    
    function test_CannotBeCalledByNonOwner() public {
        address[] memory addresses = new address[](1);
        addresses[0] = nonOwner;
        
        vm.prank(nonOwner);
        vm.expectRevert("GroupAdmin: caller is not an admin");
        conference.attend(addresses);
        
        assertFalse(conference.isAttended(nonOwner));
        assertEq(conference.attended(), 0);
    }
    
    function test_IsAttendedFalseIfNotCalled() public view {
        assertFalse(conference.isAttended(owner));
    }
    
    function test_CannotAttendNonRegisteredAddress() public {
        address[] memory addresses = new address[](2);
        addresses[0] = nonOwner;
        addresses[1] = notRegistered;
        
        vm.expectRevert("Conference: address not registered");
        conference.attend(addresses);
        
        assertFalse(conference.isAttended(nonOwner));
        assertFalse(conference.isAttended(notRegistered));
        assertEq(conference.attended(), 0);
    }
    
    function test_CannotAttendTwice() public {
        address[] memory addresses = new address[](1);
        addresses[0] = nonOwner;
        conference.attend(addresses);
        
        vm.expectRevert("Conference: already attended");
        conference.attend(addresses);
        
        assertTrue(conference.isAttended(nonOwner));
        assertEq(conference.attended(), 1);
    }
}

contract ConferenceEmptyEventTest is ConferenceTest {
    function test_NothingToWithdrawIfNoOneAttends() public {
        conference.payback();
        assertEq(conference.payoutAmount(), 0);
    }
}

contract ConferencePaybackTest is ConferenceTest {
    function setUp() public override {
        super.setUp();
        
        vm.prank(attended);
        conference.register{value: deposit}(TWITTER_HANDLE);
        
        vm.prank(notAttended);
        conference.register{value: deposit}(TWITTER_HANDLE);
        
        address[] memory addresses = new address[](1);
        addresses[0] = attended;
        conference.attend(addresses);
    }
    
    function test_CannotWithdrawIfNonOwnerCalls() public {
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        conference.payback();
        
        vm.prank(attended);
        vm.expectRevert("Conference: event has not ended");
        conference.withdraw();
        
        assertEq(address(conference).balance, deposit * 2);
        assertFalse(conference.isPaid(attended));
    }
    
    function test_CannotWithdrawIfDidNotAttend() public {
        conference.payback();
        
        vm.prank(notAttended);
        vm.expectRevert("Conference: did not attend");
        conference.withdraw();
        
        assertEq(address(conference).balance, deposit * 2);
        assertFalse(conference.isPaid(notAttended));
    }
    
    function test_CanWithdrawIfAttend() public {
        conference.payback();
        uint256 previousBalance = attended.balance;
        assertEq(address(conference).balance, deposit * 2);
        
        vm.prank(attended);
        conference.withdraw();
        
        assertEq(address(conference).balance, 0);
        uint256 currentBalance = attended.balance;
        uint256 diff = currentBalance - previousBalance;
        // Should receive approximately 2x deposit (minus gas)
        assertGt(diff, (deposit * 19) / 10);
        assertTrue(conference.isPaid(attended));
    }
    
    function test_CannotRegisterAfterPayback() public {
        conference.payback();
        uint256 currentRegistered = conference.registered();
        
        vm.prank(notRegistered);
        vm.expectRevert("Conference: event has ended");
        conference.register{value: deposit}("some handler");
        
        assertEq(conference.registered(), currentRegistered);
        assertTrue(conference.ended());
    }
    
    function test_CannotAttendAfterPayback() public {
        conference.payback();
        uint256 currentAttended = conference.attended();
        
        address[] memory addresses = new address[](1);
        addresses[0] = notAttended;
        
        vm.expectRevert("Conference: event has ended");
        conference.attend(addresses);
        
        assertEq(conference.attended(), currentAttended);
        assertTrue(conference.ended());
    }
}

contract ConferenceCancelTest is ConferenceTest {
    function setUp() public override {
        super.setUp();
        
        vm.prank(attended);
        conference.register{value: deposit}(TWITTER_HANDLE);
        
        vm.prank(notAttended);
        conference.register{value: deposit}(TWITTER_HANDLE);
        
        address[] memory addresses = new address[](1);
        addresses[0] = attended;
        conference.attend(addresses);
    }
    
    function test_CannotCancelIfNonOwnerCalls() public {
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        conference.cancel();
        
        vm.prank(attended);
        vm.expectRevert("Conference: event has not ended");
        conference.withdraw();
        
        assertEq(address(conference).balance, deposit * 2);
    }
    
    function test_EverybodyReceivesRefund() public {
        conference.cancel();
        
        // attended withdraws
        uint256 previousBalance = attended.balance;
        assertEq(address(conference).balance, deposit * 2);
        
        vm.prank(attended);
        conference.withdraw();
        
        assertEq(address(conference).balance, deposit);
        uint256 currentBalance = attended.balance;
        uint256 diff = currentBalance - previousBalance;
        assertGt(diff, (deposit * 9) / 10);
        assertTrue(conference.isPaid(attended));
        
        // notAttended withdraws
        previousBalance = notAttended.balance;
        
        vm.prank(notAttended);
        conference.withdraw();
        
        assertEq(address(conference).balance, 0);
        currentBalance = notAttended.balance;
        diff = currentBalance - previousBalance;
        assertGt(diff, (deposit * 9) / 10);
        assertTrue(conference.isPaid(notAttended));
    }
    
    function test_CannotRegisterAfterCancel() public {
        conference.cancel();
        uint256 currentRegistered = conference.registered();
        
        vm.prank(notRegistered);
        vm.expectRevert("Conference: event has ended");
        conference.register{value: deposit}("some handler");
        
        assertEq(conference.registered(), currentRegistered);
        assertTrue(conference.ended());
    }
    
    function test_CannotCancelIfAlreadyEnded() public {
        conference.payback();
        
        vm.expectRevert("Conference: event has ended");
        conference.cancel();
        
        assertEq(address(conference).balance, deposit * 2);
        
        // notAttended cannot withdraw after payback (didn't attend)
        vm.prank(notAttended);
        vm.expectRevert("Conference: did not attend");
        conference.withdraw();
        
        assertEq(address(conference).balance, deposit * 2);
        
        // attended can withdraw
        vm.prank(attended);
        conference.withdraw();
        
        assertEq(address(conference).balance, 0);
        assertTrue(conference.ended());
    }
}

contract ConferenceWithdrawTest is ConferenceTest {
    address registered;
    
    function setUp() public override {
        super.setUp();
        registered = nonOwner;
        
        conference.register{value: deposit}(TWITTER_HANDLE);
        
        vm.prank(registered);
        conference.register{value: deposit}(TWITTER_HANDLE);
        
        assertEq(address(conference).balance, deposit * 2);
    }
    
    function test_CannotWithdrawTwice() public {
        conference.cancel();
        
        vm.prank(registered);
        conference.withdraw();
        
        vm.prank(registered);
        vm.expectRevert("Conference: already paid");
        conference.withdraw();
        
        assertEq(address(conference).balance, deposit);
    }
    
    function test_CannotWithdrawIfNotRegistered() public {
        conference.cancel();
        
        vm.prank(notRegistered);
        vm.expectRevert("Conference: not a participant");
        conference.withdraw();
        
        assertEq(address(conference).balance, deposit * 2);
    }
}

contract ConferenceClearTest is ConferenceTest {
    uint256 constant ONE_WEEK = 1 weeks;
    
    function test_DefaultCoolingPeriodIsOneWeek() public view {
        assertEq(conference.coolingPeriod(), ONE_WEEK);
    }
    
    function test_CoolingPeriodCanBeSet() public {
        Conference customConference = new Conference("", 0, 0, 10);
        assertEq(customConference.coolingPeriod(), 10);
    }
    
    function test_CannotClearByNonOwner() public {
        Conference customConference = new Conference("", 0, 0, 10);
        uint256 customDeposit = customConference.deposit();
        
        customConference.register{value: customDeposit}("one");
        assertEq(address(customConference).balance, customDeposit);
        
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        customConference.clear();
        
        assertEq(address(customConference).balance, customDeposit);
    }
    
    function test_CannotClearIfEventNotEnded() public {
        conference.register{value: deposit}("one");
        assertEq(address(conference).balance, deposit);
        
        vm.expectRevert("Conference: event has not ended");
        conference.clear();
        
        assertEq(address(conference).balance, deposit);
    }
    
    function test_CannotClearIfCoolingPeriodNotPassed() public {
        conference.register{value: deposit}("one");
        conference.cancel();
        assertTrue(conference.ended());
        assertEq(address(conference).balance, deposit);
        
        vm.expectRevert("Conference: cooling period not passed");
        conference.clear();
        
        assertEq(address(conference).balance, deposit);
    }
    
    function test_OwnerReceivesRemainingIfCoolingPeriodPassed() public {
        // Use a regular EOA as owner to receive ETH
        address payable testOwner = payable(makeAddr("testOwner"));
        vm.deal(testOwner, 100 ether);
        
        vm.prank(testOwner);
        Conference customConference = new Conference("", 0, 0, 1);
        uint256 customDeposit = customConference.deposit();
        
        vm.prank(testOwner);
        customConference.register{value: customDeposit}("one");
        
        vm.prank(testOwner);
        customConference.cancel();
        assertTrue(customConference.ended());
        assertEq(address(customConference).balance, customDeposit);
        
        uint256 previousBalance = testOwner.balance;
        
        // Advance time by 2 seconds (cooling period is 1 second)
        vm.warp(block.timestamp + 2);
        
        vm.prank(testOwner);
        customConference.clear();
        
        uint256 currentBalance = testOwner.balance;
        uint256 diff = currentBalance - previousBalance;
        assertGt(diff, (customDeposit * 9) / 10);
        assertEq(address(customConference).balance, 0);
    }
}


