// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Individual ERC20 token for each bond
contract BondToken is ERC20 {
    address public immutable curveAMM;
    uint256 public immutable bondId;
    
    constructor(
        string memory name,
        string memory symbol,
        uint256 _bondId,
        address _curveAMM
    ) ERC20(name, symbol) {
        bondId = _bondId;
        curveAMM = _curveAMM;
    }
    
    function mint(address to, uint256 amount) external {
        require(msg.sender == curveAMM, "Only CurveAMM can mint");
        _mint(to, amount);
    }
    
    function burnFrom(address from, uint256 amount) external {
        require(msg.sender == curveAMM, "Only CurveAMM can burn");
        _burn(from, amount);
    }
}

// Factory to deploy ERC20 tokens for bonds
contract BondTokenFactory is Ownable {
    mapping(uint256 => address) public bondTokens; // bondId => token address
    address public curveAMM;
    
    event BondTokenCreated(uint256 indexed bondId, address tokenAddress, string name, string symbol);
    
    constructor() Ownable(msg.sender) {}
    
    function setCurveAMM(address _curveAMM) external onlyOwner {
        require(_curveAMM != address(0), "Invalid address");
        curveAMM = _curveAMM;
    }
    
    function createBondToken(uint256 bondId) external returns (address) {
        require(msg.sender == curveAMM, "Only CurveAMM can create tokens");
        require(bondTokens[bondId] == address(0), "Token already exists");
        
        string memory name = string(abi.encodePacked("Bond Token #", toString(bondId)));
        string memory symbol = string(abi.encodePacked("BOND", toString(bondId)));
        
        BondToken token = new BondToken(name, symbol, bondId, curveAMM);
        bondTokens[bondId] = address(token);
        
        emit BondTokenCreated(bondId, address(token), name, symbol);
        return address(token);
    }
    
    function getBondToken(uint256 bondId) external view returns (address) {
        return bondTokens[bondId];
    }
    
    // Helper function to convert uint to string
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}