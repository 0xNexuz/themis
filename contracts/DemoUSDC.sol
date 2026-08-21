// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
/// @notice Galileo-only token with no monetary value. Each address can claim once.
contract DemoUSDC is ERC20 {
    uint256 public constant CLAIM_AMOUNT = 1_000e6;
    mapping(address => bool) public claimed;
    error AlreadyClaimed();
    constructor() ERC20("Themis Demo USDC", "dUSDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function claim() external { if (claimed[msg.sender]) revert AlreadyClaimed(); claimed[msg.sender] = true; _mint(msg.sender, CLAIM_AMOUNT); }
}
