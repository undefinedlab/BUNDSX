// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./bn.sol";

/**
 * @title BondFactory
 * @dev Factory contract for creating bonds by locking NFTs and deploying BondNFT clones
 */
contract BondFactory is ReentrancyGuard, Ownable {
    
    // Events
    event BondCreated(
        uint256 indexed bondId, 
        address indexed creator, 
        address bondNFTAddress,
        string bondName,
        string description,
        NFTAsset[] assets,
        uint256 timestamp
    );
    
    event NFTsReleased(
        uint256 indexed bondId, 
        address indexed recipient,
        uint256 timestamp
    );
    
    event BondRedeemed(
        uint256 indexed bondId,
        address indexed creator,
        uint256 timestamp
    );
    
    event CurveAMMSet(address indexed curveAMM);
    
    event BondDefragmentalized(
        uint256 indexed bondId,
        address indexed creator,
        uint256 timestamp
    );
    
    // Structs
    struct NFTAsset {
        address contractAddress;  // NFT contract address
        uint256 tokenId;         // Token ID
        uint256 amount;          // Amount (1 for ERC721, can be >1 for ERC1155)
        bool isERC1155;          // True if ERC1155, false if ERC721
    }
    
    struct BondData {
        address creator;          // Who created the bond
        address bondNFTContract;  // Address of the BondNFT clone
        NFTAsset[] assets;        // Locked NFT assets
        bool isRedeemed;          // Whether NFTs have been released
        uint256 createdAt;        // Creation timestamp
        uint256 totalAssets;      // Number of assets in bond
        string bondName;          // Human readable bond name
        string description;       // Bond description with NFT details
        string bondNumber;        // Collection number (e.g., "001", "002")
    }
    
    // Struct for createBond parameters to avoid stack too deep
    struct CreateBondParams {
        NFTAsset[] assets;
        string bondName;
        string description;
    }
    
    // State variables
    mapping(uint256 => BondData) public bonds;
    mapping(address => uint256[]) public userBonds;     // User -> bondIds[]
    mapping(address => mapping(uint256 => bool)) public assetLocked; // contract -> tokenId -> locked
    
    uint256 public nextBondId = 1;
    address public immutable bondNFTImplementation;
    address public curveAMM;
    
    // Security limits
    uint256 public constant MAX_NFTS_PER_BOND = 50;
    uint256 public constant MAX_BONDS_PER_USER = 100;
    
    // Stats
    uint256 public totalBondsCreated;
    uint256 public totalNFTsLocked;
    uint256 public totalBondsRedeemed;
    
    constructor(address _bondNFTImplementation) Ownable(msg.sender) {
        require(_bondNFTImplementation != address(0), "Invalid implementation");
        bondNFTImplementation = _bondNFTImplementation;
    }
    
    /**
     * @dev Set CurveAMM contract address (owner only, one time)
     */
    function setCurveAMM(address _curveAMM) external onlyOwner {
        require(_curveAMM != address(0), "Invalid CurveAMM address");
        require(curveAMM == address(0), "CurveAMM already set");
        
        curveAMM = _curveAMM;
        emit CurveAMMSet(_curveAMM);
    }
    
    /**
     * @dev Creates a new bond by locking NFTs and minting Bond NFT
     * @param params Struct containing assets, bondName, and description
     * @return bondId The unique identifier for the created bond
     * @return bondNFTAddress Address of the deployed BondNFT clone
     */
    function createBond(CreateBondParams calldata params) 
        external 
        nonReentrant 
        returns (uint256 bondId, address bondNFTAddress) 
    {
        // Input validation
        _validateCreateBondInput(params);
        
        // Check for duplicate assets in the same bond
        _validateNoDuplicates(params.assets);
        
        // Validate ownership and availability
        _validateAssetOwnership(params.assets, msg.sender);
        
        uint256 newBondId = nextBondId++;
        
        // Transfer NFTs to factory
        _transferAssetsToFactory(params.assets, msg.sender);
        
        // Deploy BondNFT clone
        bondNFTAddress = _deployBondNFT(newBondId, msg.sender);
        
        // Generate bond collection number (001, 002, etc.)
        string memory bondNumber = _formatBondNumber(totalBondsCreated + 1);
        
        // Store bond data
        _storeBondData(newBondId, bondNFTAddress, params, bondNumber);
        
        // Update user bonds tracking
        userBonds[msg.sender].push(newBondId);
        
        // Update stats
        totalBondsCreated++;
        totalNFTsLocked += params.assets.length;
        
        // Set CurveAMM in BondNFT if available
        if (curveAMM != address(0)) {
            IBondNFT(bondNFTAddress).setCurveAMM(curveAMM);
        }
        
        emit BondCreated(newBondId, msg.sender, bondNFTAddress, params.bondName, params.description, params.assets, block.timestamp);
        
        return (newBondId, bondNFTAddress);
    }
    
    /**
     * @dev Direct redemption without fractionalization (owner only)
     * @param bondId The bond ID to redeem
     */
    function redeemBond(uint256 bondId) external nonReentrant {
        _validateRedemption(bondId);
        _transferAssetsToCreator(bondId);
        _finalizeRedemption(bondId);
    }
    
    /**
     * @dev Defragmentalize a bond (convert back from fractionalized to whole bond)
     * @param bondId The bond ID to defragmentalize
     */
    function defragmentalizeBond(uint256 bondId) external nonReentrant {
        BondData storage bond = bonds[bondId];
        require(bond.creator == msg.sender, "Only bond creator can defragmentalize");
        require(!bond.isRedeemed, "Bond already redeemed");
        require(bond.bondNFTContract != address(0), "Bond NFT doesn't exist");
        
        // Get bond data to check if fractionalized
        (, , , bool isFragmentalized, ,) = IBondNFT(bond.bondNFTContract).getBondData();
        require(isFragmentalized, "Bond is not fractionalized");
        
        // Check if any tokens were sold in the curve (if CurveAMM exists)
        if (curveAMM != address(0)) {
            // Check if market exists and has sold tokens
            bool marketExists = ICurveAMM(curveAMM).isMarketActive(bondId);
            if (marketExists) {
                (, , uint256 tokensSold, , , , ,) = ICurveAMM(curveAMM).getMarketInfo(bondId);
                require(tokensSold == 0, "Cannot defragmentalize bond with sold tokens");
                
                // Close market first if it exists
                ICurveAMM(curveAMM).closeMarketByFactory(bondId);
            }
        }
        
        // Call defragmentalize on BondNFT
        IBondNFT(bond.bondNFTContract).defragmentalize();
        
        emit BondDefragmentalized(bondId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Releases NFTs back to recipient (called by BondNFT contract only)
     * @param bondId The bond ID to release
     * @param recipient Address to receive the NFTs
     */
    function releaseNFTs(uint256 bondId, address recipient) 
        external 
        nonReentrant 
    {
        _validateRelease(bondId, recipient);
        _transferAssetsToRecipient(bondId, recipient);
        _finalizeRelease(bondId, recipient);
    }
    
    // Internal functions to avoid stack too deep
    
    /**
     * @dev Validate createBond input parameters
     */
    function _validateCreateBondInput(CreateBondParams calldata params) private view {
        require(params.assets.length > 0, "No assets provided");
        require(params.assets.length <= MAX_NFTS_PER_BOND, "Too many NFTs");
        require(userBonds[msg.sender].length < MAX_BONDS_PER_USER, "Max bonds reached");
        require(bytes(params.bondName).length > 0, "Bond name required");
        require(bytes(params.description).length > 0, "Description required");
    }
    
    /**
     * @dev Store bond data in storage
     */
    function _storeBondData(
        uint256 bondId, 
        address bondNFTAddress, 
        CreateBondParams calldata params,
        string memory bondNumber
    ) private {
        BondData storage bond = bonds[bondId];
        bond.creator = msg.sender;
        bond.bondNFTContract = bondNFTAddress;
        bond.createdAt = block.timestamp;
        bond.totalAssets = params.assets.length;
        bond.bondName = params.bondName;
        bond.description = params.description;
        bond.bondNumber = bondNumber;
        
        // Copy assets and mark as locked
        for (uint256 i = 0; i < params.assets.length; i++) {
            bond.assets.push(params.assets[i]);
            assetLocked[params.assets[i].contractAddress][params.assets[i].tokenId] = true;
        }
    }
    
    /**
     * @dev Validate redemption preconditions (updated for defragmentalization support)
     */
    function _validateRedemption(uint256 bondId) private view {
        BondData storage bond = bonds[bondId];
        require(bond.creator == msg.sender, "Only bond creator can redeem");
        require(!bond.isRedeemed, "Already redeemed");
        require(bond.assets.length > 0, "No assets to redeem");
        
        // Check if bond is fractionalized - if so, must use BondNFT redemption or defragmentalize first
        if (bond.bondNFTContract != address(0)) {
            (, , , bool isFragmentalized, ,) = IBondNFT(bond.bondNFTContract).getBondData();
            require(!isFragmentalized, "Must defragmentalize bond first or use BondNFT redemption");
        }
    }
    
    /**
     * @dev Transfer assets back to creator during redemption
     */
    function _transferAssetsToCreator(uint256 bondId) private {
        BondData storage bond = bonds[bondId];
        
        // Burn the Bond NFT if it exists
        if (bond.bondNFTContract != address(0)) {
            IBondNFT(bond.bondNFTContract).burn(bondId);
        }
        
        // Transfer all NFTs back to creator
        for (uint256 i = 0; i < bond.assets.length; i++) {
            NFTAsset memory asset = bond.assets[i];
            
            _transferSingleAsset(asset, msg.sender);
            
            // Mark as unlocked
            assetLocked[asset.contractAddress][asset.tokenId] = false;
        }
    }
    
    /**
     * @dev Finalize redemption by updating state
     */
    function _finalizeRedemption(uint256 bondId) private {
        BondData storage bond = bonds[bondId];
        
        // Mark as redeemed
        bond.isRedeemed = true;
        
        // Update stats
        totalBondsRedeemed++;
        totalNFTsLocked -= bond.assets.length;
        
        emit BondRedeemed(bondId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Validate NFT release preconditions
     */
    function _validateRelease(uint256 bondId, address recipient) private view {
        BondData storage bond = bonds[bondId];
        
        // Security checks
        require(msg.sender == bond.bondNFTContract, "Only Bond NFT can release");
        require(!bond.isRedeemed, "Already redeemed");
        require(bond.assets.length > 0, "No assets to release");
        require(recipient != address(0), "Invalid recipient");
    }
    
    /**
     * @dev Transfer assets to recipient during release
     */
    function _transferAssetsToRecipient(uint256 bondId, address recipient) private {
        BondData storage bond = bonds[bondId];
        
        // Transfer all NFTs to recipient
        for (uint256 i = 0; i < bond.assets.length; i++) {
            NFTAsset memory asset = bond.assets[i];
            
            _transferSingleAsset(asset, recipient);
            
            // Mark as unlocked
            assetLocked[asset.contractAddress][asset.tokenId] = false;
        }
    }
    
    /**
     * @dev Finalize release by updating state
     */
    function _finalizeRelease(uint256 bondId, address recipient) private {
        BondData storage bond = bonds[bondId];
        
        // Mark as redeemed
        bond.isRedeemed = true;
        
        // Update stats
        totalBondsRedeemed++;
        totalNFTsLocked -= bond.assets.length;
        
        emit NFTsReleased(bondId, recipient, block.timestamp);
    }
    
    /**
     * @dev Transfer a single NFT asset
     */
    function _transferSingleAsset(NFTAsset memory asset, address recipient) private {
        if (asset.isERC1155) {
            IERC1155(asset.contractAddress).safeTransferFrom(
                address(this),
                recipient,
                asset.tokenId,
                asset.amount,
                ""
            );
        } else {
            IERC721(asset.contractAddress).safeTransferFrom(
                address(this),
                recipient,
                asset.tokenId
            );
        }
    }
    
    /**
     * @dev Validates that user owns all assets and they're not already locked
     */
    function _validateAssetOwnership(NFTAsset[] calldata assets, address owner) 
        private 
        view 
    {
        for (uint256 i = 0; i < assets.length; i++) {
            NFTAsset calldata asset = assets[i];
            
            // Check if already locked
            require(
                !assetLocked[asset.contractAddress][asset.tokenId], 
                "Asset already locked"
            );
            
            if (asset.isERC1155) {
                require(asset.amount > 0, "Invalid ERC1155 amount");
                require(
                    IERC1155(asset.contractAddress).balanceOf(owner, asset.tokenId) >= asset.amount,
                    "Insufficient ERC1155 balance"
                );
            } else {
                require(asset.amount == 1, "ERC721 amount must be 1");
                require(
                    IERC721(asset.contractAddress).ownerOf(asset.tokenId) == owner,
                    "Not NFT owner"
                );
            }
        }
    }
    
    /**
     * @dev Check for duplicate assets in the same bond
     */
    function _validateNoDuplicates(NFTAsset[] calldata assets) 
        private 
        pure 
    {
        for (uint256 i = 0; i < assets.length; i++) {
            require(assets[i].contractAddress != address(0), "Invalid NFT contract");
            for (uint256 j = i + 1; j < assets.length; j++) {
                require(
                    assets[i].contractAddress != assets[j].contractAddress ||
                    assets[i].tokenId != assets[j].tokenId,
                    "Duplicate asset"
                );
            }
        }
    }
    
    /**
     * @dev Transfers assets from user to factory
     */
    function _transferAssetsToFactory(NFTAsset[] calldata assets, address from) 
        private 
    {
        for (uint256 i = 0; i < assets.length; i++) {
            NFTAsset calldata asset = assets[i];
            
            if (asset.isERC1155) {
                IERC1155(asset.contractAddress).safeTransferFrom(
                    from,
                    address(this),
                    asset.tokenId,
                    asset.amount,
                    ""
                );
            } else {
                IERC721(asset.contractAddress).safeTransferFrom(
                    from,
                    address(this),
                    asset.tokenId
                );
            }
        }
    }
    
    /**
     * @dev Deploys a new BondNFT clone for the bond
     */
    function _deployBondNFT(uint256 bondId, address creator) 
        private 
        returns (address) 
    {
        // Create deterministic salt for predictable addresses
        bytes32 salt = keccak256(abi.encodePacked(bondId, creator, block.timestamp));
        
        // Store clone address first
        address clone = Clones.cloneDeterministic(bondNFTImplementation, salt);
        
        // Use interface for initialization
        IBondNFT(clone).initialize(bondId, creator, address(this));
        
        return clone;
    }
    
    /**
     * @dev Format bond number with leading zeros (001, 002, etc.)
     */
    function _formatBondNumber(uint256 number) private pure returns (string memory) {
        if (number < 10) {
            return string(abi.encodePacked("00", _toString(number)));
        } else if (number < 100) {
            return string(abi.encodePacked("0", _toString(number)));
        } else {
            return _toString(number);
        }
    }
    
    /**
     * @dev Convert uint to string
     */
    function _toString(uint256 value) private pure returns (string memory) {
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
    
    // View functions
    function getBondAssets(uint256 bondId) 
        external 
        view 
        returns (NFTAsset[] memory) 
    {
        return bonds[bondId].assets;
    }
    
    function getBondInfo(uint256 bondId) 
        external 
        view 
        returns (
            address creator,
            address bondNFTContract,
            bool isRedeemed,
            uint256 createdAt,
            uint256 assetCount
        ) 
    {
        BondData storage bond = bonds[bondId];
        return (
            bond.creator,
            bond.bondNFTContract,
            bond.isRedeemed,
            bond.createdAt,
            bond.totalAssets
        );
    }
    
    function getBondMetadata(uint256 bondId)
        external
        view
        returns (
            string memory bondName,
            string memory description,
            string memory bondNumber,
            uint256 totalAssets
        )
    {
        BondData storage bond = bonds[bondId];
        return (
            bond.bondName,
            bond.description,
            bond.bondNumber,
            bond.totalAssets
        );
    }
    
    function getUserBonds(address user) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return userBonds[user];
    }
    
    function isAssetLocked(address contractAddress, uint256 tokenId) 
        external 
        view 
        returns (bool) 
    {
        return assetLocked[contractAddress][tokenId];
    }
    
    function getStats() 
        external 
        view 
        returns (
            uint256 _totalBondsCreated,
            uint256 _totalNFTsLocked,
            uint256 _totalBondsRedeemed,
            uint256 _nextBondId
        ) 
    {
        return (
            totalBondsCreated,
            totalNFTsLocked,
            totalBondsRedeemed,
            nextBondId
        );
    }
    
    /**
     * @dev Check if a bond can be defragmentalized
     */
    function canDefragmentalize(uint256 bondId) 
        external 
        view 
        returns (bool canDefrag, string memory reason) 
    {
        BondData storage bond = bonds[bondId];
        
        if (bond.creator == address(0)) {
            return (false, "Bond doesn't exist");
        }
        
        if (bond.isRedeemed) {
            return (false, "Bond already redeemed");
        }
        
        if (bond.bondNFTContract == address(0)) {
            return (false, "Bond NFT doesn't exist");
        }
        
        (, , , bool isFragmentalized, ,) = IBondNFT(bond.bondNFTContract).getBondData();
        if (!isFragmentalized) {
            return (false, "Bond is not fractionalized");
        }
        
        // Check if any tokens were sold in the curve
        if (curveAMM != address(0)) {
            bool marketExists = ICurveAMM(curveAMM).marketExists(bondId);
            if (marketExists) {
                (, , uint256 tokensSold, , , , ,) = ICurveAMM(curveAMM).getMarketInfo(bondId);
                if (tokensSold > 0) {
                    return (false, "Cannot defragmentalize bond with sold tokens");
                }
            }
        }
        
        return (true, "Can be defragmentalized");
    }
    
    // Emergency functions (owner only)
    function emergencySetCurveAMM(uint256 bondId, address _curveAMM) 
        external 
        onlyOwner 
    {
        require(_curveAMM != address(0), "Invalid CurveAMM");
        BondData storage bond = bonds[bondId];
        require(bond.bondNFTContract != address(0), "Bond doesn't exist");
        
        IBondNFT(bond.bondNFTContract).setCurveAMM(_curveAMM);
    }
    
    // Required for receiving NFTs
    function onERC721Received(
        address, 
        address, 
        uint256, 
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
    
    function onERC1155Received(
        address, 
        address, 
        uint256, 
        uint256, 
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }
    
    function onERC1155BatchReceived(
        address, 
        address, 
        uint256[] calldata, 
        uint256[] calldata, 
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}

// Enhanced IBondNFT interface with defragmentalization support
interface IBondNFT {
    function initialize(uint256 bondId, address creator, address factory) external;
    function setCurveAMM(address _curveAMM) external;
    function getBondData() external view returns (
        uint256 totalSupply,
        uint256 tokensReturned,
        uint256 feeVault,
        bool isFragmentalized,
        address creator,
        uint256 createdAt
    );
    function burn(uint256 tokenId) external;
    function defragmentalize() external;
}

// Enhanced ICurveAMM interface for defragmentalization support
// Note: ICurveAMM interface is already defined in bn.sol