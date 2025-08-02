// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Individual ERC20 token for each bond
contract BondToken is ERC20 {
    address public immutable curveAMM;
    uint256 public immutable bondId;
    
    // SECURITY: Added events for tracking
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    
    constructor(
        string memory name,
        string memory symbol,
        uint256 _bondId,
        address _curveAMM
    ) ERC20(name, symbol) {
        require(_curveAMM != address(0), "Invalid CurveAMM address");
        bondId = _bondId;
        curveAMM = _curveAMM;
    }
    
    function mint(address to, uint256 amount) external {
        require(msg.sender == curveAMM, "Only CurveAMM can mint");
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Cannot mint zero amount");
        
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
    
    function burnFrom(address from, uint256 amount) external {
        require(msg.sender == curveAMM, "Only CurveAMM can burn");
        require(from != address(0), "Cannot burn from zero address");
        require(amount > 0, "Cannot burn zero amount");
        require(balanceOf(from) >= amount, "Insufficient balance to burn");
        
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }
    
    // SECURITY: Override transfer functions to add additional validation
    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        require(to != address(0), "Cannot transfer to zero address");
        return super.transfer(to, amount);
    }
    
    function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
        require(to != address(0), "Cannot transfer to zero address");
        return super.transferFrom(from, to, amount);
    }
}

// Factory to deploy ERC20 tokens for bonds
contract BondTokenFactory is Ownable {
    mapping(uint256 => address) public bondTokens; // bondId => token address
    address public curveAMM;
    
    // SECURITY: Added initialization tracking
    bool private initialized = false;
    
    event BondTokenCreated(uint256 indexed bondId, address tokenAddress, string name, string symbol);
    event CurveAMMSet(address indexed curveAMM);
    
    constructor() Ownable(msg.sender) {}
    
    function setCurveAMM(address _curveAMM) external onlyOwner {
        require(_curveAMM != address(0), "Invalid address");
        require(!initialized, "Already initialized");
        curveAMM = _curveAMM;
        initialized = true;
        emit CurveAMMSet(_curveAMM);
    }
    
    // FIXED: Updated function signature to match CurveAMM call
    function createBondToken(uint256 bondId, string memory bondName) external returns (address) {
        require(initialized, "Factory not initialized");
        require(msg.sender == curveAMM, "Only CurveAMM can create tokens");
        require(bondTokens[bondId] == address(0), "Token already exists");
        require(bytes(bondName).length > 0, "Bond name cannot be empty");
        
        // SECURITY: Enhanced naming with bond name
        string memory name = string(abi.encodePacked(bondName, " Token"));
        string memory symbol = string(abi.encodePacked("BOND", toString(bondId)));
        
        // SECURITY: Additional validation for symbol length
        require(bytes(symbol).length <= 11, "Symbol too long"); // ERC20 standard recommendation
        
        BondToken token = new BondToken(name, symbol, bondId, curveAMM);
        bondTokens[bondId] = address(token);
        
        emit BondTokenCreated(bondId, address(token), name, symbol);
        return address(token);
    }
    
    function getBondToken(uint256 bondId) external view returns (address) {
        return bondTokens[bondId];
    }
    
    // SECURITY: Add function to check if token exists
    function tokenExists(uint256 bondId) external view returns (bool) {
        return bondTokens[bondId] != address(0);
    }
    
    // SECURITY: Add function to get token info
    function getTokenInfo(uint256 bondId) external view returns (
        address tokenAddress,
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        bool exists
    ) {
        address tokenAddr = bondTokens[bondId];
        if (tokenAddr == address(0)) {
            return (address(0), "", "", 0, false);
        }
        
        BondToken token = BondToken(tokenAddr);
        return (
            tokenAddr,
            token.name(),
            token.symbol(),
            token.totalSupply(),
            true
        );
    }
    
    // SECURITY: Enhanced helper function with bounds checking
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        
        uint256 temp = value;
        uint256 digits;
        
        // Count digits
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        // SECURITY: Prevent extremely long strings
        require(digits <= 78, "Number too large to convert");
        
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    // SECURITY: Emergency functions
    function emergencyPause() external onlyOwner {
        // Can be extended to pause token creation if needed
        // For now, just an event for monitoring
        emit EmergencyPauseTriggered(msg.sender);
    }
    
    event EmergencyPauseTriggered(address indexed triggeredBy);
    
    // SECURITY: Get factory status
    function getFactoryStatus() external view returns (
        bool isInitialized,
        address ammAddress,
        uint256 totalTokensCreated
    ) {
        uint256 count = 0;
        // This is a simple count - in production you might want to track this more efficiently
        for (uint256 i = 1; i <= 10000; i++) { // Check first 10k bond IDs
            if (bondTokens[i] != address(0)) {
                count++;
            }
        }
        
        return (initialized, curveAMM, count);
    }
}