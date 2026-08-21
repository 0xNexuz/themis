// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;
contract FailingToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public failTransfers;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function setFailTransfers(bool value) external { failTransfers = value; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) { if (failTransfers) return false; allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
    function transfer(address to, uint256 amount) external returns (bool) { if (failTransfers) return false; balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
}
