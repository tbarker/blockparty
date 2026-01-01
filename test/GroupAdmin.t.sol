// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/GroupAdmin.sol";

contract GroupAdminTest is Test {
    GroupAdmin public admin;
    
    address public owner;
    address public operator;
    address public anotherOperator;
    address public oneMoreOperator;
    address public nonOperator;
    
    event AdminGranted(address indexed grantee);
    event AdminRevoked(address indexed grantee);
    
    function setUp() public virtual {
        owner = address(this);
        operator = makeAddr("operator");
        anotherOperator = makeAddr("anotherOperator");
        oneMoreOperator = makeAddr("oneMoreOperator");
        nonOperator = makeAddr("nonOperator");
        
        admin = new GroupAdmin();
    }
}

contract GroupAdminNewTest is GroupAdminTest {
    function test_OwnerIsAdmin() public view {
        assertTrue(admin.isAdmin(owner));
    }
}

contract GroupAdminGrantTest is GroupAdminTest {
    function test_IsAddedToAdmin() public {
        address[] memory admins = new address[](2);
        admins[0] = operator;
        admins[1] = anotherOperator;
        
        admin.grant(admins);
        
        assertTrue(admin.isAdmin(operator));
        assertTrue(admin.isAdmin(anotherOperator));
        assertFalse(admin.isAdmin(nonOperator));
    }
    
    function test_CannotBeAddedByNonOwner() public {
        address[] memory admins = new address[](1);
        admins[0] = operator;
        
        vm.prank(operator);
        vm.expectRevert("Ownable: caller is not the owner");
        admin.grant(admins);
        
        assertFalse(admin.isAdmin(operator));
    }
    
    function test_EmitsAdminGrantedEvent() public {
        address[] memory admins = new address[](1);
        admins[0] = operator;
        
        vm.expectEmit(true, false, false, false);
        emit AdminGranted(operator);
        
        admin.grant(admins);
    }
}

contract GroupAdminRevokeTest is GroupAdminTest {
    function setUp() public override {
        super.setUp();
        
        address[] memory admins = new address[](3);
        admins[0] = operator;
        admins[1] = anotherOperator;
        admins[2] = oneMoreOperator;
        admin.grant(admins);
        
        assertTrue(admin.isAdmin(operator));
        assertTrue(admin.isAdmin(anotherOperator));
        assertTrue(admin.isAdmin(oneMoreOperator));
        assertEq(admin.numOfAdmins(), 3);
    }
    
    function test_IsRevokedFromAdmin() public {
        address[] memory toRevoke = new address[](2);
        toRevoke[0] = operator;
        toRevoke[1] = oneMoreOperator;
        
        admin.revoke(toRevoke);
        
        assertFalse(admin.isAdmin(operator));
        assertTrue(admin.isAdmin(anotherOperator));
        assertFalse(admin.isAdmin(oneMoreOperator));
        assertEq(admin.numOfAdmins(), 1);
    }
    
    function test_CannotBeRevokedByNonOwner() public {
        address[] memory toRevoke = new address[](1);
        toRevoke[0] = operator;
        
        vm.prank(operator);
        vm.expectRevert("Ownable: caller is not the owner");
        admin.revoke(toRevoke);
        
        assertTrue(admin.isAdmin(operator));
    }
    
    function test_EmitsAdminRevokedEvent() public {
        address[] memory toRevoke = new address[](1);
        toRevoke[0] = operator;
        
        vm.expectEmit(true, false, false, false);
        emit AdminRevoked(operator);
        
        admin.revoke(toRevoke);
    }
}

contract GroupAdminListTest is GroupAdminTest {
    function test_ListNumberOfAdmins() public {
        address[] memory firstGrant = new address[](1);
        firstGrant[0] = operator;
        admin.grant(firstGrant);
        
        address[] memory secondGrant = new address[](1);
        secondGrant[0] = nonOperator;
        admin.grant(secondGrant);
        
        address[] memory admins = admin.getAdmins();
        assertEq(admins[0], operator);
        assertEq(admins[1], nonOperator);
        assertEq(admin.numOfAdmins(), 2);
    }
}
