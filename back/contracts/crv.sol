// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./bnt.sol"; 

interface IBondNFT {
    function markFragmentalized(uint256 totalSupply) external;
    function addToVault() external payable;
    function ownerOf(uint256 tokenId) external view returns (address);
    function getBondData() external view returns (
        uint256 totalSupply,
        uint256 tokensReturned,
        uint256 feeVault,
        bool isFragmentalized,
        address creator,
        uint256 createdAt
    );
}

interface IBondFactory {
    function getBondInfo(uint256 bondId) external view returns (
        address creator,
        address bondNFTContract,
        bool isRedeemed,
        uint256 createdAt,
        uint256 assetCount
    );
}

/**
 * @title CurveAMM
 * @dev Exponential bonding curve AMM for trading fractionalized Bond tokens
 */
contract CurveAMM is ReentrancyGuard, Ownable {
    
    // Events
    event MarketCreated(
        uint256 indexed bondId,
        address indexed creator,
        address tokenContract,
        uint256 totalSupply,
        uint256 tokensForSale,
        uint256 timestamp
    );
    
    event TokensPurchased(
        uint256 indexed bondId,
        address indexed buyer,
        uint256 tokenAmount,
        uint256 ethCost,
        uint256 feeAmount,
        uint256 newPrice
    );
    
    event TokensSold(
        uint256 indexed bondId,
        address indexed seller,
        uint256 tokenAmount,
        uint256 ethReceived,
        uint256 feeAmount,
        uint256 newPrice
    );
    
    event MarketClosed(
        uint256 indexed bondId,
        address indexed closer,
        uint256 timestamp
    );
    
    // Market data structure with exponential curve
    struct Market {
        uint256 totalSupply;           // Total tokens created for this bond
        uint256 tokensForSale;         // Original tokens put up for sale
        uint256 tokensSold;            // How many tokens have been sold from curve
        uint256 ethReserve;            // ETH in the curve
        uint256 currentPrice;          // Current token price in wei (next token price)
        bool isActive;                 // Whether market is active
        address creator;               // Who created this market
        uint256 createdAt;             // Market creation timestamp
        address tokenContract;         // ERC20 token contract address
    }
    
    // State variables
    mapping(uint256 => Market) public markets;
    mapping(uint256 => bool) public marketExists;
    
    IBondFactory public immutable bondFactory;
    BondTokenFactory public bondTokenFactory;
    
    // Exponential curve constants
    uint256 public constant FEE_RATE = 250; // 2.5% (250/10000)
    uint256 public constant CURVE_STEEPNESS = 1000; // Controls price growth rate
    uint256 public constant PRICE_SCALE = 1e15; // Base price multiplier (0.001 ETH scale)
    
    // Statistics
    uint256 public totalMarketsCreated;
    uint256 public totalVolumeETH;
    uint256 public totalFeesCollected;
    
    constructor(address _bondFactory, address _bondTokenFactory) Ownable(msg.sender) {
        require(_bondFactory != address(0), "Invalid factory address");
        require(_bondTokenFactory != address(0), "Invalid token factory address");
        bondFactory = IBondFactory(_bondFactory);
         bondTokenFactory = BondTokenFactory(_bondTokenFactory);
    }


    /**
     * @dev Create a new market for a bond with exponential curve
     * @param bondId The bond ID to create market for
     * @param totalSupply Total tokens to create
     * @param tokensForSale How many tokens to put in curve for trading
     */
    function createMarket(
        uint256 bondId,
        uint256 totalSupply,
        uint256 tokensForSale
    ) external nonReentrant {
        require(totalSupply > 0 && totalSupply <= 10**12, "Invalid total supply");
        require(tokensForSale > 0 && tokensForSale <= totalSupply, "Invalid tokens for sale");
        require(!marketExists[bondId], "Market already exists");
        
        // Get bond info from factory
        (address creator, address bondNFTContract, bool isRedeemed,,) = 
            bondFactory.getBondInfo(bondId);
        
        require(creator != address(0), "Bond doesn't exist");
        require(!isRedeemed, "Bond already redeemed");
        require(msg.sender == creator, "Only bond creator can create market");
        
        // Verify caller owns the Bond NFT
        require(
            IBondNFT(bondNFTContract).ownerOf(bondId) == msg.sender,
            "Not bond owner"
        );
        
        // Deploy ERC20 token for this bond
        address tokenContract = bondTokenFactory.createBondToken(bondId);
        
        // Mark bond as fractionalized
        IBondNFT(bondNFTContract).markFragmentalized(totalSupply);
        
        // Initialize market with exponential curve (starts at price 0)
        Market storage market = markets[bondId];
        market.totalSupply = totalSupply;
        market.tokensForSale = tokensForSale;
        market.tokensSold = 0; // Start at 0
        market.ethReserve = 0; // Start at 0
        market.currentPrice = _calculatePrice(1); // Price of first token
        market.isActive = true;
        market.creator = msg.sender;
        market.createdAt = block.timestamp;
        market.tokenContract = tokenContract;
        
        // Mint tokens to creator (total - tokensForSale)
        uint256 tokensToCreator = totalSupply - tokensForSale;
        if (tokensToCreator > 0) {
            BondToken(tokenContract).mint(msg.sender, tokensToCreator);
        }
        
        marketExists[bondId] = true;
        totalMarketsCreated++;
        
        emit MarketCreated(bondId, msg.sender, tokenContract, totalSupply, tokensForSale, block.timestamp);
    }
    
    /**
     * @dev Buy tokens from the exponential curve
     * @param bondId The bond market to buy from
     * @param tokenAmount Number of tokens to buy
     */
    function buyTokens(uint256 bondId, uint256 tokenAmount) 
        external 
        payable 
        nonReentrant 
    {
        require(tokenAmount > 0, "Invalid token amount");
        require(marketExists[bondId], "Market doesn't exist");
        
        Market storage market = markets[bondId];
        require(market.isActive, "Market not active");
        require(market.tokensSold + tokenAmount <= market.tokensForSale, "Not enough tokens available");
        
        // Calculate total cost for buying tokenAmount tokens
        uint256 totalCost = _calculateBuyCost(bondId, tokenAmount);
        require(msg.value >= totalCost, "Insufficient ETH sent");
        
        // Calculate fee
        uint256 feeAmount = (totalCost * FEE_RATE) / 10000;
        uint256 ethForReserve = totalCost - feeAmount;
        
        // Update market state
        market.tokensSold += tokenAmount;
        market.ethReserve += ethForReserve;
        market.currentPrice = _calculatePrice(market.tokensSold + 1);
        
        // Mint real ERC20 tokens to buyer
        BondToken(market.tokenContract).mint(msg.sender, tokenAmount);
        
        // Send fee to Bond NFT vault
        if (feeAmount > 0) {
            _sendFeeToVault(bondId, feeAmount);
        }
        
        // Refund excess ETH
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }
        
        // Update stats
        totalVolumeETH += totalCost;
        totalFeesCollected += feeAmount;
        
        emit TokensPurchased(
            bondId, 
            msg.sender, 
            tokenAmount, 
            ethForReserve, 
            feeAmount, 
            market.currentPrice
        );
    }
    
    /**
     * @dev Sell tokens back to the exponential curve
     * @param bondId The bond market to sell to
     * @param tokenAmount Amount of tokens to sell
     */
    function sellTokens(
        uint256 bondId, 
        uint256 tokenAmount
    ) external nonReentrant {
        require(tokenAmount > 0, "Invalid token amount");
        require(marketExists[bondId], "Market doesn't exist");
        
        Market storage market = markets[bondId];
        require(market.isActive, "Market not active");
        require(tokenAmount <= market.tokensSold, "Cannot sell more than sold");
        
        // Check user has enough ERC20 tokens
        require(
            IERC20(market.tokenContract).balanceOf(msg.sender) >= tokenAmount,
            "Insufficient token balance"
        );
        
        // Calculate ETH to receive for selling tokenAmount tokens
        uint256 totalRefund = _calculateSellRefund(bondId, tokenAmount);
        require(totalRefund <= market.ethReserve, "Not enough ETH in reserve");
        
        // Calculate fee
        uint256 feeAmount = (totalRefund * FEE_RATE) / 10000;
        uint256 ethToUser = totalRefund - feeAmount;
        
        // Burn ERC20 tokens from seller
        BondToken(market.tokenContract).burnFrom(msg.sender, tokenAmount);
        
        // Update market state
        market.tokensSold -= tokenAmount;
        market.ethReserve -= totalRefund;
        market.currentPrice = market.tokensSold > 0 ? _calculatePrice(market.tokensSold + 1) : _calculatePrice(1);
        
        // Send ETH to user
        if (ethToUser > 0) {
            payable(msg.sender).transfer(ethToUser);
        }
        
        // Send fee to Bond NFT vault
        if (feeAmount > 0) {
            _sendFeeToVault(bondId, feeAmount);
        }
        
        // Update stats
        totalVolumeETH += totalRefund;
        totalFeesCollected += feeAmount;
        
        emit TokensSold(
            bondId, 
            msg.sender, 
            tokenAmount, 
            ethToUser, 
            feeAmount, 
            market.currentPrice
        );
    }
    
    /**
     * @dev Calculate price for token number n (exponential curve)
     * Price = (n^2 * PRICE_SCALE) / CURVE_STEEPNESS
     * Token 1: ~0.001 ETH, Token 100: ~0.1 ETH, Token 500: ~2.5 ETH
     */
    function _calculatePrice(uint256 tokenNumber) private pure returns (uint256) {
        if (tokenNumber == 0) return 0;
        return (tokenNumber * tokenNumber * PRICE_SCALE) / CURVE_STEEPNESS;
    }
    
    /**
     * @dev Calculate total cost to buy tokenAmount tokens starting from current position
     */
    function _calculateBuyCost(uint256 bondId, uint256 tokenAmount) private view returns (uint256) {
        Market storage market = markets[bondId];
        uint256 totalCost = 0;
        
        for (uint256 i = 1; i <= tokenAmount; i++) {
            uint256 tokenNumber = market.tokensSold + i;
            totalCost += _calculatePrice(tokenNumber);
        }
        
        return totalCost;
    }
    
    /**
     * @dev Calculate total refund for selling tokenAmount tokens from current position
     */
    function _calculateSellRefund(uint256 bondId, uint256 tokenAmount) private view returns (uint256) {
        Market storage market = markets[bondId];
        uint256 totalRefund = 0;
        
        for (uint256 i = 0; i < tokenAmount; i++) {
            uint256 tokenNumber = market.tokensSold - i;
            if (tokenNumber > 0) {
                totalRefund += _calculatePrice(tokenNumber);
            }
        }
        
        return totalRefund;
    }
    
    /**
     * @dev Burn tokens (called by BondNFT for vault redemption)
     */
    function burnTokens(uint256 bondId, address user, uint256 amount) 
        external 
        nonReentrant 
    {
        require(marketExists[bondId], "Market doesn't exist");
        require(amount > 0, "Invalid burn amount");
        
        // Verify caller is the Bond NFT contract
        (, address bondNFTContract,,,) = bondFactory.getBondInfo(bondId);
        require(msg.sender == bondNFTContract, "Only Bond NFT can burn");
        
        Market storage market = markets[bondId];
        
        // Burn ERC20 tokens
        BondToken(market.tokenContract).burnFrom(user, amount);
    }
    
    /**
     * @dev Send fee to Bond NFT vault
     */
    function _sendFeeToVault(uint256 bondId, uint256 feeAmount) private {
        if (feeAmount == 0) return;
        
        (, address bondNFTContract,,,) = bondFactory.getBondInfo(bondId);
        if (bondNFTContract != address(0)) {
            IBondNFT(bondNFTContract).addToVault{value: feeAmount}();
        }
    }
    
    // View functions
    /**
     * @dev Get market information
     */
    function getMarketInfo(uint256 bondId) 
        external 
        view 
        returns (
            uint256 totalSupply,
            uint256 tokensForSale,
            uint256 tokensSold,
            uint256 ethReserve,
            uint256 currentPrice,
            bool isActive,
            address creator,
            uint256 createdAt
        ) 
    {
        Market storage market = markets[bondId];
        return (
            market.totalSupply,
            market.tokensForSale,
            market.tokensSold,
            market.ethReserve,
            market.currentPrice,
            market.isActive,
            market.creator,
            market.createdAt
        );
    }
    
    /**
     * @dev Get ERC20 token contract for a bond
     */
    function getBondTokenContract(uint256 bondId) external view returns (address) {
        return markets[bondId].tokenContract;
    }
    
    /**
     * @dev Get user's token balance for a bond (ERC20 balance)
     */
    function getTokenBalance(uint256 bondId, address user) 
        external 
        view 
        returns (uint256) 
    {
        address tokenContract = markets[bondId].tokenContract;
        if (tokenContract == address(0)) return 0;
        return IERC20(tokenContract).balanceOf(user);
    }
    
    /**
     * @dev Get total supply for a bond market
     */
    function getTotalSupply(uint256 bondId) 
        external 
        view 
        returns (uint256) 
    {
        return markets[bondId].totalSupply;
    }
    
    /**
     * @dev Get tokens available for purchase in curve
     */
    function getTokensAvailable(uint256 bondId) external view returns (uint256) {
        Market storage market = markets[bondId];
        return market.tokensForSale - market.tokensSold;
    }
    
    /**
     * @dev Preview cost to buy specific number of tokens
     */
    function previewBuyCost(uint256 bondId, uint256 tokenAmount) 
        external 
        view 
        returns (uint256 totalCost, uint256 feeAmount) 
    {
        require(marketExists[bondId], "Market doesn't exist");
        
        totalCost = _calculateBuyCost(bondId, tokenAmount);
        feeAmount = (totalCost * FEE_RATE) / 10000;
    }
    
    /**
     * @dev Preview refund for selling specific number of tokens
     */
    function previewSellRefund(uint256 bondId, uint256 tokenAmount) 
        external 
        view 
        returns (uint256 totalRefund, uint256 feeAmount, uint256 userReceives) 
    {
        require(marketExists[bondId], "Market doesn't exist");
        
        totalRefund = _calculateSellRefund(bondId, tokenAmount);
        feeAmount = (totalRefund * FEE_RATE) / 10000;
        userReceives = totalRefund - feeAmount;
    }
    
    /**
     * @dev Get price for a specific token number
     */
    function getTokenPrice(uint256 tokenNumber) external pure returns (uint256) {
        return _calculatePrice(tokenNumber);
    }
    
    /**
     * @dev Get protocol statistics
     */
    function getStats() 
        external 
        view 
        returns (
            uint256 _totalMarketsCreated,
            uint256 _totalVolumeETH,
            uint256 _totalFeesCollected
        ) 
    {
        return (
            totalMarketsCreated,
            totalVolumeETH,
            totalFeesCollected
        );
    }
    
    // Market management functions
    /**
     * @dev Check if a market exists for a bond
     */
    function marketExists(uint256 bondId) external view returns (bool) {
        return marketExists[bondId];
    }
    
    /**
     * @dev Close market by factory (called during bond defragmentalization)
     * @param bondId The bond ID to close market for
     */
    function closeMarketByFactory(uint256 bondId) external {
        require(marketExists[bondId], "Market doesn't exist");
        require(msg.sender == address(bondFactory), "Only factory can close market");
        
        Market storage market = markets[bondId];
        require(market.isActive, "Market already closed");
        require(market.tokensSold == 0, "Cannot close market with sold tokens");
        
        market.isActive = false;
        
        emit MarketClosed(bondId, msg.sender, block.timestamp);
    }
    
    // Emergency functions (owner only)
    /**
     * @dev Emergency pause market
     */
    function emergencyPauseMarket(uint256 bondId) external onlyOwner {
        require(marketExists[bondId], "Market doesn't exist");
        markets[bondId].isActive = false;
    }
    
    /**
     * @dev Emergency unpause market
     */
    function emergencyUnpauseMarket(uint256 bondId) external onlyOwner {
        require(marketExists[bondId], "Market doesn't exist");
        markets[bondId].isActive = true;
    }
    
    /**
     * @dev Emergency withdraw stuck ETH (only if no active markets)
     */
    function emergencyWithdrawETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // Initialization function to call AFTER deployment
    function initializeBondTokenFactory() external onlyOwner {
        require(address(bondTokenFactory.curveAMM()) == address(0), "Already initialized");
        bondTokenFactory.setCurveAMM(address(this));
    }
        



}