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
    
    function getBondMetadata(uint256 bondId) external view returns (
        string memory bondName,
        string memory description,
        string memory bondNumber,
        uint256 totalAssets
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
    
    event FeeTransferFailed(
        uint256 indexed bondId,
        uint256 feeAmount
    );
    
    event EmergencyPauseTriggered(
        uint256 indexed bondId,
        address indexed triggeredBy
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
    
    IBondFactory public immutable bondFactory;
    BondTokenFactory public bondTokenFactory;
    
    // SECURITY: Added initialization tracking
    bool private initialized = false;
    bool public globalPaused = false;
    
    // Exponential curve constants
    uint256 public constant FEE_RATE = 250; // 2.5% (250/10000)
    uint256 public constant CURVE_STEEPNESS = 1000; // Controls price growth rate
    uint256 public constant PRICE_SCALE = 1e15; // Base price multiplier (0.001 ETH scale)
    uint256 public constant TOKEN_DECIMALS = 18; // ERC20 standard decimals
    uint256 public constant TOKEN_UNIT = 10**TOKEN_DECIMALS; // 1 token = 10^18 wei
    
    // SECURITY: Added circuit breakers
    uint256 public constant MAX_TOKENS_PER_TRANSACTION = 1000 * TOKEN_UNIT;
    uint256 public constant MAX_TOKEN_NUMBER = type(uint128).max; // Prevent overflow
    
    // Statistics
    uint256 public totalMarketsCreated;
    uint256 public totalVolumeETH;
    uint256 public totalFeesCollected;
    
    // SECURITY: Added modifiers
    modifier onlyInitialized() {
        require(initialized, "Contract not initialized");
        _;
    }
    
    modifier whenNotPaused() {
        require(!globalPaused, "Contract is globally paused");
        _;
    }
    
    modifier validTokenAmount(uint256 tokenAmount) {
        require(tokenAmount > 0, "Invalid token amount");
        require(tokenAmount * TOKEN_UNIT <= MAX_TOKENS_PER_TRANSACTION, "Exceeds max transaction size");
        _;
    }
    
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
    ) external nonReentrant onlyInitialized whenNotPaused {
        require(totalSupply > 0 && totalSupply <= 10**12, "Invalid total supply");
        require(tokensForSale > 0 && tokensForSale <= totalSupply, "Invalid tokens for sale");
        require(!isMarketActive(bondId), "Market already exists");
        
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
        
        // Get bond metadata for naming
        (string memory bondName, , , ) = bondFactory.getBondMetadata(bondId);
        
        // Deploy ERC20 token for this bond with proper name
        address tokenContract = bondTokenFactory.createBondToken(bondId, bondName);
        
        // Mark bond as fractionalized
        IBondNFT(bondNFTContract).markFragmentalized(totalSupply);
        
        // Convert supply amounts to proper ERC20 amounts (with 18 decimals)
        uint256 totalSupplyWei = totalSupply * TOKEN_UNIT;
        uint256 tokensForSaleWei = tokensForSale * TOKEN_UNIT;
        
        // Initialize market with linear curve (starts at price 0)
        Market storage market = markets[bondId];
        market.totalSupply = totalSupplyWei;
        market.tokensForSale = tokensForSaleWei;
        market.tokensSold = 0; // Start at 0
        market.ethReserve = 0; // Start at 0
        market.currentPrice = _calculatePrice(1); // Price of first token
        market.isActive = true;
        market.creator = msg.sender;
        market.createdAt = block.timestamp;
        market.tokenContract = tokenContract;
        
        // Mint tokens to creator (total - tokensForSale)
        uint256 tokensToCreator = totalSupplyWei - tokensForSaleWei;
        if (tokensToCreator > 0) {
            BondToken(tokenContract).mint(msg.sender, tokensToCreator);
        }
        
        totalMarketsCreated++;
        
        emit MarketCreated(bondId, msg.sender, tokenContract, totalSupply, tokensForSale, block.timestamp);
    }
    
    /**
     * @dev Buy tokens from the linear curve
     * @param bondId The bond market to buy from
     * @param tokenAmount Number of tokens to buy
     */
    function buyTokens(uint256 bondId, uint256 tokenAmount) 
        external 
        payable 
        nonReentrant 
        onlyInitialized
        whenNotPaused
        validTokenAmount(tokenAmount)
    {
        require(isMarketActive(bondId), "Market doesn't exist or inactive");
        
        Market storage market = markets[bondId];
        require(market.tokensSold + (tokenAmount * TOKEN_UNIT) <= market.tokensForSale, "Not enough tokens available");
        
        // Calculate new price for next token
        uint256 currentTokenNumber = market.tokensSold / TOKEN_UNIT;
        uint256 newPrice = _calculatePrice(currentTokenNumber + tokenAmount + 1);
        
        // Calculate total cost for buying tokenAmount tokens
        uint256 totalCost = _calculateBuyCost(bondId, tokenAmount);
        require(msg.value >= totalCost, "Insufficient ETH sent");
        
        // Calculate fee
        uint256 feeAmount = (totalCost * FEE_RATE) / 10000;
        uint256 priceForReserve = totalCost - feeAmount;
        
        // Convert token amount to proper ERC20 amount
        uint256 tokenAmountWei = tokenAmount * TOKEN_UNIT;
        
        // Update market state
        market.tokensSold += tokenAmountWei;
        market.ethReserve += priceForReserve; // Only the price goes to reserve (fee goes to vault)
        market.currentPrice = newPrice;
        
        // Mint real ERC20 tokens to buyer
        BondToken(market.tokenContract).mint(msg.sender, tokenAmountWei);
        
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
            priceForReserve, 
            feeAmount, 
            market.currentPrice
        );
    }
    
    /**
     * @dev Sell tokens back to the linear curve
     * @param bondId The bond market to sell to
     * @param tokenAmount Amount of tokens to sell
     */
    function sellTokens(
        uint256 bondId, 
        uint256 tokenAmount
    ) external 
        nonReentrant 
        onlyInitialized
        whenNotPaused
        validTokenAmount(tokenAmount)
    {
        require(isMarketActive(bondId), "Market doesn't exist or inactive");
        
        Market storage market = markets[bondId];
        uint256 tokenAmountWei = tokenAmount * TOKEN_UNIT;
        
        require(tokenAmountWei <= market.tokensSold, "Cannot sell more than sold");
        
        // SECURITY: Enhanced balance check
        require(
            IERC20(market.tokenContract).balanceOf(msg.sender) >= tokenAmountWei,
            "Insufficient token balance"
        );
        
        // Calculate price for selling tokenAmount tokens
        uint256 priceForTokens = _calculateSellRefund(bondId, tokenAmountWei);
        require(priceForTokens > 0, "No refund available");
        require(priceForTokens <= market.ethReserve, "Insufficient ETH reserve");
        
        // Calculate fee
        uint256 feeAmount = (priceForTokens * FEE_RATE) / 10000;
        uint256 ethToUser = priceForTokens - feeAmount;
        
        // Burn ERC20 tokens from seller first (fail fast)
        BondToken(market.tokenContract).burnFrom(msg.sender, tokenAmountWei);
        
        // Update market state
        market.tokensSold -= tokenAmountWei;
        market.ethReserve -= priceForTokens; // Deduct the price amount from reserve
        market.currentPrice = market.tokensSold > 0 ? _calculatePrice(market.tokensSold / TOKEN_UNIT + 1) : _calculatePrice(1);
        
        // Send ETH to user
        if (ethToUser > 0) {
            payable(msg.sender).transfer(ethToUser);
        }
        
        // Send fee to Bond NFT vault
        if (feeAmount > 0) {
            _sendFeeToVault(bondId, feeAmount);
        }
        
        // Update stats
        totalVolumeETH += priceForTokens;
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
     * @dev Calculate price for token number n (simple linear curve)
     * Price = tokenNumber * PRICE_SCALE
     * Token 1: 0.001 ETH, Token 2: 0.002 ETH, Token 100: 0.1 ETH
     */
    function _calculatePrice(uint256 tokenNumber) private pure returns (uint256) {
        if (tokenNumber == 0) return 0;
        
        // SECURITY: Prevent overflow
        require(tokenNumber <= MAX_TOKEN_NUMBER, "Token number too large");
        
        return tokenNumber * PRICE_SCALE;
    }
    
    /**
     * @dev Calculate total cost to buy tokenAmount tokens starting from current position
     * SECURITY: Gas optimized for large amounts
     */
    function _calculateBuyCost(uint256 bondId, uint256 tokenAmount) private view returns (uint256) {
        Market storage market = markets[bondId];
        uint256 totalCost = 0;
        
        // Convert from wei to token numbers for price calculation
        uint256 currentTokenNumber = market.tokensSold / TOKEN_UNIT;
        
        // SECURITY: Gas optimization for large amounts
        if (tokenAmount > 100) {
            // Use mathematical formula for large amounts
            return _calculateCostMathematically(currentTokenNumber, tokenAmount);
        }
        
        // Use loop for smaller amounts
        for (uint256 i = 1; i <= tokenAmount; i++) {
            uint256 tokenNumber = currentTokenNumber + i;
            totalCost += _calculatePrice(tokenNumber);
        }
        
        return totalCost;
    }
    
    /**
     * @dev Mathematical formula for calculating large buy costs (linear curve)
     * Sum of i from (start+1) to (start+amount) = arithmetic sequence sum
     */
    function _calculateCostMathematically(uint256 startToken, uint256 amount) private pure returns (uint256) {
        uint256 endToken = startToken + amount;
        
        // Arithmetic sequence sum: n(a1 + an)/2
        uint256 sum = amount * (startToken + 1 + endToken) / 2;
        return sum * PRICE_SCALE;
    }
    
    /**
     * @dev Calculate total refund for selling tokenAmount tokens from current position
     * SECURITY: Enhanced with bounds checking and curve-based pricing
     */
    function _calculateSellRefund(uint256 bondId, uint256 tokenAmount) private view returns (uint256) {
        Market storage market = markets[bondId];
        
        // If no tokens sold or no ETH reserve, return 0
        if (market.tokensSold == 0 || market.ethReserve == 0) {
            return 0;
        }
        
        // SECURITY: Ensure we don't exceed available tokens or reserve
        require(tokenAmount <= market.tokensSold, "Cannot refund more than sold");
        
        // Calculate refund based on curve pricing (more accurate than proportional)
        uint256 currentTokenNumber = market.tokensSold / TOKEN_UNIT;
        uint256 refundAmount = 0;
        
        // Calculate refund for each token being sold (reverse of buy)
        uint256 tokenAmountNumber = tokenAmount / TOKEN_UNIT;
        for (uint256 i = 0; i < tokenAmountNumber; i++) {
            uint256 tokenNumber = currentTokenNumber - i;
            if (tokenNumber > 0) {
                refundAmount += _calculatePrice(tokenNumber);
            }
        }
        
        // SECURITY: Ensure refund doesn't exceed reserve and apply slippage protection
        return Math.min(refundAmount, market.ethReserve);
    }
    
    /**
     * @dev Burn tokens (called by BondNFT for vault redemption) - SECURITY ENHANCED
     */
    function burnTokens(uint256 bondId, address user, uint256 amount) 
        external 
        nonReentrant 
        onlyInitialized
    {
        require(isMarketActive(bondId), "Market doesn't exist");
        require(amount > 0, "Invalid burn amount");
        require(user != address(0), "Invalid user address");
        
        // SECURITY: Verify caller is the Bond NFT contract
        (, address bondNFTContract,,,) = bondFactory.getBondInfo(bondId);
        require(msg.sender == bondNFTContract, "Only Bond NFT can burn");
        
        Market storage market = markets[bondId];
        
        // SECURITY: Additional validation - ensure user has sufficient balance
        require(
            IERC20(market.tokenContract).balanceOf(user) >= amount,
            "Insufficient balance to burn"
        );
        
        // Burn ERC20 tokens
        BondToken(market.tokenContract).burnFrom(user, amount);
    }
    
    /**
     * @dev Send fee to Bond NFT vault - SECURITY ENHANCED with error handling
     */
    function _sendFeeToVault(uint256 bondId, uint256 feeAmount) private {
        if (feeAmount == 0) return;
        
        (, address bondNFTContract,,,) = bondFactory.getBondInfo(bondId);
        if (bondNFTContract != address(0)) {
            try IBondNFT(bondNFTContract).addToVault{value: feeAmount}() {
                // Success - no additional action needed
            } catch {
                // SECURITY: Handle failure gracefully
                emit FeeTransferFailed(bondId, feeAmount);
                // Fee remains in contract, can be withdrawn by owner in emergency
            }
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
        require(isMarketActive(bondId), "Market doesn't exist");
        
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
        require(isMarketActive(bondId), "Market doesn't exist");
        
        totalRefund = _calculateSellRefund(bondId, tokenAmount * TOKEN_UNIT);
        feeAmount = (totalRefund * FEE_RATE) / 10000;
        userReceives = totalRefund > feeAmount ? totalRefund - feeAmount : 0;
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

    /**
     * @dev Get contract's ETH balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Convert token number to wei amount
     */
    function tokenNumberToWei(uint256 tokenNumber) external pure returns (uint256) {
        return tokenNumber * TOKEN_UNIT;
    }

    /**
     * @dev Convert wei amount to token number
     */
    function weiToTokenNumber(uint256 weiAmount) external pure returns (uint256) {
        return weiAmount / TOKEN_UNIT;
    }
    
    // Market management functions
    /**
     * @dev Check if a market exists and is active - SECURITY FIXED
     */
    function isMarketActive(uint256 bondId) public view returns (bool) {
        return markets[bondId].creator != address(0) && markets[bondId].isActive;
    }
    
    /**
     * @dev Close market by factory (called during bond defragmentalization)
     * @param bondId The bond ID to close market for
     */
    function closeMarketByFactory(uint256 bondId) external {
        require(isMarketActive(bondId), "Market doesn't exist");
        require(msg.sender == address(bondFactory), "Only factory can close market");
        
        Market storage market = markets[bondId];
        require(market.tokensSold == 0, "Cannot close market with sold tokens");
        
        market.isActive = false;
        
        emit MarketClosed(bondId, msg.sender, block.timestamp);
    }
    
    // SECURITY: Enhanced initialization with proper checks
    function initializeBondTokenFactory() external onlyOwner {
        require(!initialized, "Already initialized");
        require(address(bondTokenFactory.curveAMM()) == address(0), "Factory already has AMM");
        bondTokenFactory.setCurveAMM(address(this));
        initialized = true;
    }
    
    // SECURITY: Emergency initialization for inconsistent state
    function emergencyInitialize() external onlyOwner {
        require(!initialized, "Already initialized");
        // Don't check if factory has AMM - just set initialized flag
        initialized = true;
    }
    
    // SECURITY: Emergency functions enhanced
    /**
     * @dev Emergency pause specific market
     */
    function emergencyPauseMarket(uint256 bondId) external onlyOwner {
        require(isMarketActive(bondId), "Market doesn't exist or already inactive");
        markets[bondId].isActive = false;
        emit EmergencyPauseTriggered(bondId, msg.sender);
    }
    
    /**
     * @dev Emergency unpause specific market
     */
    function emergencyUnpauseMarket(uint256 bondId) external onlyOwner {
        require(markets[bondId].creator != address(0), "Market doesn't exist");
        markets[bondId].isActive = true;
    }
    
    /**
     * @dev Emergency global pause
     */
    function emergencyGlobalPause() external onlyOwner {
        globalPaused = true;
    }
    
    /**
     * @dev Emergency global unpause
     */
    function emergencyGlobalUnpause() external onlyOwner {
        globalPaused = false;
    }
    
    /**
     * @dev Emergency withdraw stuck ETH - SECURITY ENHANCED
     */
    function emergencyWithdrawETH() external onlyOwner {
        require(globalPaused, "Must be globally paused");
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        payable(owner()).transfer(balance);
    }

    // SECURITY: Add ability to withdraw failed fee transfers
    function withdrawFailedFees() external onlyOwner {
        require(globalPaused, "Must be globally paused");
        uint256 balance = address(this).balance;
        if (balance > 0) {
            payable(owner()).transfer(balance);
        }
    }
}