// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

interface IBondFactory {
    function releaseNFTs(uint256 bondId, address recipient) external;
}

interface ICurveAMM {
    function getTokenBalance(uint256 bondId, address user) external view returns (uint256);
    function burnTokens(uint256 bondId, address user, uint256 amount) external;
    function getTotalSupply(uint256 bondId) external view returns (uint256);
}

/**
 * @title BondNFT
 * @dev NFT representing ownership of locked assets with fractionalization capability
 */
contract BondNFT is ERC721, ReentrancyGuard, Initializable {
    
    // Events
    event Fractionalized(uint256 indexed bondId, uint256 totalSupply);
    event VaultDeposit(uint256 indexed bondId, uint256 amount);
    event TokensRedeemed(uint256 indexed bondId, address indexed user, uint256 tokenAmount, uint256 ethAmount);
    event NFTsClaimed(uint256 indexed bondId, address indexed owner);
    event CurveAMMSet(uint256 indexed bondId, address curveAMM);
    
    // Bond state
    struct BondData {
        uint256 totalSupply;      // Total tokens created on fractionalization
        uint256 tokensReturned;   // Tokens burned back to this contract
        uint256 feeVault;         // Accumulated ETH from trading fees
        bool isFragmentalized;     // Whether bond is split into tokens
        address creator;          // Original bond creator
        uint256 createdAt;        // Bond creation timestamp
    }
    
    // State variables
    uint256 public bondId;
    BondData public bondData;
    IBondFactory public bondFactory;
    ICurveAMM public curveAMM;
    
    // Access control
    modifier onlyCurve() {
        require(msg.sender == address(curveAMM), "Only CurveAMM");
        _;
    }
    
    modifier onlyBondOwner() {
        require(ownerOf(bondId) == msg.sender, "Not bond owner");
        _;
    }
    
    modifier onlyFactoryOrOwner() {
        require(
            msg.sender == address(bondFactory) || 
            msg.sender == bondData.creator,
            "Unauthorized"
        );
        _;
    }
    
    constructor() ERC721("BondNFT", "BOND") {
        // Implementation contract - disable initializers
        _disableInitializers();
    }
    
    /**
     * @dev Initialize clone (called by BondFactory)
     * @param _bondId Unique bond identifier
     * @param _creator Address that created the bond
     * @param _bondFactory Factory contract address
     */
    function initialize(
        uint256 _bondId,
        address _creator,
        address _bondFactory
    ) external initializer {
        require(_creator != address(0), "Invalid creator");
        require(_bondFactory != address(0), "Invalid factory");
        
        bondId = _bondId;
        bondData.creator = _creator;
        bondData.createdAt = block.timestamp;
        bondFactory = IBondFactory(_bondFactory);
        
        // Mint Bond NFT to creator
        _mint(_creator, _bondId);
    }
    
    /**
     * @dev Set CurveAMM address (called once after deployment)
     * @param _curveAMM Address of the CurveAMM contract
     */
    function setCurveAMM(address _curveAMM) external onlyFactoryOrOwner {
        require(address(curveAMM) == address(0), "CurveAMM already set");
        require(_curveAMM != address(0), "Invalid CurveAMM address");
        
        curveAMM = ICurveAMM(_curveAMM);
        
        emit CurveAMMSet(bondId, _curveAMM);
    }
    
    /**
     * @dev Mark bond as fractionalized with specified supply (called by CurveAMM)
     * @param _totalSupply Total number of tokens to create
     */
    function markFragmentalized(uint256 _totalSupply) external onlyCurve {
        require(!bondData.isFragmentalized, "Already fractionalized");
        require(_totalSupply > 0 && _totalSupply <= 10**9, "Invalid total supply");
        
        bondData.isFragmentalized = true;
        bondData.totalSupply = _totalSupply;
        
        emit Fractionalized(bondId, _totalSupply);
    }
    
    /**
     * @dev Receive trading fees from CurveAMM
     */
    function addToVault() external payable onlyCurve {
        require(msg.value > 0, "No ETH sent");
        
        bondData.feeVault += msg.value;
        
        emit VaultDeposit(bondId, msg.value);
    }
    
    /**
     * @dev Redeem tokens for proportional vault ETH (safety net exit)
     * @param tokenAmount Number of tokens to burn for ETH
     */
    function redeemMyTokens(uint256 tokenAmount) external nonReentrant {
        require(bondData.isFragmentalized, "Not fractionalized");
        require(tokenAmount > 0, "Invalid amount");
        require(address(curveAMM) != address(0), "CurveAMM not set");
        
        // Verify user owns these tokens in CurveAMM
        uint256 userBalance = curveAMM.getTokenBalance(bondId, msg.sender);
        require(userBalance >= tokenAmount, "Insufficient token balance");
        
        // Calculate outstanding tokens and vault share
        uint256 outstandingTokens = bondData.totalSupply - bondData.tokensReturned;
        require(outstandingTokens > 0, "No outstanding tokens");
        require(tokenAmount <= outstandingTokens, "Exceeds outstanding supply");
        
        uint256 vaultShare = 0;
        if (bondData.feeVault > 0) {
            vaultShare = (bondData.feeVault * tokenAmount) / outstandingTokens;
        }
        
        // Update state first (CEI pattern)
        bondData.tokensReturned += tokenAmount;
        if (vaultShare > 0) {
            bondData.feeVault -= vaultShare;
        }
        
        // Burn tokens from CurveAMM
        curveAMM.burnTokens(bondId, msg.sender, tokenAmount);
        
        // Send ETH to user if available
        if (vaultShare > 0) {
            payable(msg.sender).transfer(vaultShare);
        }
        
        emit TokensRedeemed(bondId, msg.sender, tokenAmount, vaultShare);
    }
    
    /**
     * @dev Claim original NFTs 
     * - If not fractionalized: can unwrap immediately
     * - If fractionalized: can only unwrap when all tokens returned
     */
    function claimMyNFTs() external onlyBondOwner nonReentrant {
        // If bond is fractionalized, check that all tokens are returned
        if (bondData.isFragmentalized) {
            require(
                bondData.tokensReturned == bondData.totalSupply, 
                "Tokens still outstanding"
            );
        }
        // If not fractionalized, can always unwrap
        
        // Call factory to release NFTs to bond owner
        bondFactory.releaseNFTs(bondId, msg.sender);
        
        // Send any remaining vault ETH to bond owner
        if (bondData.feeVault > 0) {
            uint256 remainingVault = bondData.feeVault;
            bondData.feeVault = 0;
            payable(msg.sender).transfer(remainingVault);
        }
        
        emit NFTsClaimed(bondId, msg.sender);
    }
    
    // View functions
    /**
     * @dev Get complete bond data
     */
    function getBondData() external view returns (
        uint256 totalSupply,
        uint256 tokensReturned,
        uint256 feeVault,
        bool isFragmentalized,
        address creator,
        uint256 createdAt
    ) {
        return (
            bondData.totalSupply,
            bondData.tokensReturned,
            bondData.feeVault,
            bondData.isFragmentalized,
            bondData.creator,
            bondData.createdAt
        );
    }
    
    /**
     * @dev Get number of tokens still outstanding
     */
    function getOutstandingTokens() external view returns (uint256) {
        if (!bondData.isFragmentalized) return 0;
        return bondData.totalSupply - bondData.tokensReturned;
    }
    
    /**
     * @dev Get current vault ETH balance
     */
    function getVaultValue() external view returns (uint256) {
        return bondData.feeVault;
    }
    
    /**
     * @dev Check if all tokens have been returned
     */
    function isFullyRedeemed() external view returns (bool) {
        return bondData.isFragmentalized && 
               bondData.tokensReturned == bondData.totalSupply;
    }
    
    /**
     * @dev Get vault redemption value for token amount
     */
    function getRedemptionValue(uint256 tokenAmount) external view returns (uint256) {
        if (!bondData.isFragmentalized || bondData.feeVault == 0) return 0;
        
        uint256 outstandingTokens = bondData.totalSupply - bondData.tokensReturned;
        if (outstandingTokens == 0) return 0;
        
        return (bondData.feeVault * tokenAmount) / outstandingTokens;
    }
    
    /**
     * @dev Emergency function - recover stuck ETH (only if not fractionalized)
     */
    function emergencyWithdraw() external onlyBondOwner {
        require(!bondData.isFragmentalized, "Cannot withdraw from fractionalized bond");
        require(address(this).balance > 0, "No ETH to withdraw");
        
        payable(msg.sender).transfer(address(this).balance);
    }
    
    /**
     * @dev Allow contract to receive ETH (only from CurveAMM)
     */
    receive() external payable {
        require(msg.sender == address(curveAMM), "Only CurveAMM can send ETH");
        bondData.feeVault += msg.value;
        emit VaultDeposit(bondId, msg.value);
    }
    
    /**
     * @dev Fallback function
     */
    fallback() external payable {
        revert("Function not found");
    }
}