import { Address } from 'viem'

// Contract addresses - Update these after deployment on Base
export const CONTRACT_ADDRESSES = {
  // These will be updated with actual deployed addresses on Base
  BOND_FACTORY: '0x301957e16A43C33Fd3330E69B06E4B53f360b0F9' as Address, // Replace with deployed Bond Factory address
  CURVE_AMM: '0xe7e4325Be5bE18897d4a5a3B7eCDf4809676FeA9' as Address, // Replace with deployed CurveAMM address
  BOND_TOKEN_FACTORY: '0x224aB7D4d491362c4b1B741Eb4edC975b76c75b0' as Address, // Replace with deployed BondTokenFactory address
} as const

// Bond Factory ABI - comprehensive functions from bnfc.sol
export const BOND_FACTORY_ABI = [
  // Bond Creation
  {
    "type": "function",
    "name": "createBond",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "components": [
          {
            "name": "assets",
            "type": "tuple[]",
            "components": [
              { "name": "contractAddress", "type": "address" },
              { "name": "tokenId", "type": "uint256" },
              { "name": "amount", "type": "uint256" },
              { "name": "isERC1155", "type": "bool" }
            ]
          },
          { "name": "bondName", "type": "string" },
          { "name": "description", "type": "string" }
        ]
      }
    ],
    "outputs": [
      { "name": "bondId", "type": "uint256" },
      { "name": "bondNFTAddress", "type": "address" }
    ],
    "stateMutability": "nonpayable"
  },
  
  // Bond Redemption
  {
    "type": "function",
    "name": "redeemBond",
    "inputs": [{ "name": "bondId", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  
  // Defragmentalization
  {
    "type": "function",
    "name": "defragmentalizeBond",
    "inputs": [{ "name": "bondId", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  
  // View Functions
  {
    "type": "function",
    "name": "getUserBonds",
    "inputs": [{ "name": "user", "type": "address" }],
    "outputs": [{ "name": "", "type": "uint256[]" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getBondInfo",
    "inputs": [{ "name": "bondId", "type": "uint256" }],
    "outputs": [
      { "name": "creator", "type": "address" },
      { "name": "bondNFTContract", "type": "address" },
      { "name": "isRedeemed", "type": "bool" },
      { "name": "createdAt", "type": "uint256" },
      { "name": "assetCount", "type": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getBondMetadata",
    "inputs": [{ "name": "bondId", "type": "uint256" }],
    "outputs": [
      { "name": "bondName", "type": "string" },
      { "name": "description", "type": "string" },
      { "name": "bondNumber", "type": "string" },
      { "name": "totalAssets", "type": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getBondAssets",
    "inputs": [{ "name": "bondId", "type": "uint256" }],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "components": [
          { "name": "contractAddress", "type": "address" },
          { "name": "tokenId", "type": "uint256" },
          { "name": "amount", "type": "uint256" },
          { "name": "isERC1155", "type": "bool" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isAssetLocked",
    "inputs": [
      { "name": "contractAddress", "type": "address" },
      { "name": "tokenId", "type": "uint256" }
    ],
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getStats",
    "inputs": [],
    "outputs": [
      { "name": "_totalBondsCreated", "type": "uint256" },
      { "name": "_totalNFTsLocked", "type": "uint256" },
      { "name": "_totalBondsRedeemed", "type": "uint256" },
      { "name": "_nextBondId", "type": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "canDefragmentalize",
    "inputs": [{ "name": "bondId", "type": "uint256" }],
    "outputs": [
      { "name": "canDefrag", "type": "bool" },
      { "name": "reason", "type": "string" }
    ],
    "stateMutability": "view"
  },
  
  // Events
  {
    "type": "event",
    "name": "BondCreated",
    "inputs": [
      { "name": "bondId", "type": "uint256", "indexed": true },
      { "name": "creator", "type": "address", "indexed": true },
      { "name": "bondNFTAddress", "type": "address", "indexed": false },
      { "name": "bondName", "type": "string", "indexed": false },
      { "name": "description", "type": "string", "indexed": false },
      { "name": "assets", "type": "tuple[]", "indexed": false },
      { "name": "timestamp", "type": "uint256", "indexed": false }
    ]
  },
  {
    "type": "event",
    "name": "BondRedeemed",
    "inputs": [
      { "name": "bondId", "type": "uint256", "indexed": true },
      { "name": "creator", "type": "address", "indexed": true },
      { "name": "timestamp", "type": "uint256", "indexed": false }
    ]
  },
  {
    "type": "event",
    "name": "BondDefragmentalized",
    "inputs": [
      { "name": "bondId", "type": "uint256", "indexed": true },
      { "name": "creator", "type": "address", "indexed": true },
      { "name": "timestamp", "type": "uint256", "indexed": false }
    ]
  }
] as const

// BondNFT ABI - functions from bn.sol
export const BOND_NFT_ABI = [
  // Bond Redemption
  {
    "type": "function",
    "name": "claimMyNFTs",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "redeemMyTokens",
    "inputs": [{ "name": "tokenAmount", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "defragmentalize",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  
  // View Functions
  {
    "type": "function",
    "name": "getBondData",
    "inputs": [],
    "outputs": [
      { "name": "totalSupply", "type": "uint256" },
      { "name": "tokensReturned", "type": "uint256" },
      { "name": "feeVault", "type": "uint256" },
      { "name": "isFragmentalized", "type": "bool" },
      { "name": "creator", "type": "address" },
      { "name": "createdAt", "type": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getOutstandingTokens",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getVaultValue",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isFullyRedeemed",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRedemptionValue",
    "inputs": [{ "name": "tokenAmount", "type": "uint256" }],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  
  // Events
  {
    "type": "event",
    "name": "NFTsClaimed",
    "inputs": [
      { "name": "bondId", "type": "uint256", "indexed": true },
      { "name": "owner", "type": "address", "indexed": true }
    ]
  },
  {
    "type": "event",
    "name": "TokensRedeemed",
    "inputs": [
      { "name": "bondId", "type": "uint256", "indexed": true },
      { "name": "user", "type": "address", "indexed": true },
      { "name": "tokenAmount", "type": "uint256", "indexed": false },
      { "name": "ethAmount", "type": "uint256", "indexed": false }
    ]
  }
] as const

// CurveAMM ABI - functions from crv.sol
export const CURVE_AMM_ABI = [
    {
      "type": "function",
      "name": "createMarket",
      "inputs": [
        { "name": "bondId", "type": "uint256" },
        { "name": "totalSupply", "type": "uint256" },
        { "name": "tokensForSale", "type": "uint256" }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "initializeBondTokenFactory",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "emergencyWithdrawETH",
      "inputs": [],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "getStats",
      "inputs": [],
      "outputs": [
        { "name": "_totalMarketsCreated", "type": "uint256" },
        { "name": "_totalVolumeETH", "type": "uint256" },
        { "name": "_totalFeesCollected", "type": "uint256" }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getMarketInfo",
      "inputs": [
        { "name": "bondId", "type": "uint256" }
      ],
      "outputs": [
        { "name": "totalSupply", "type": "uint256" },
        { "name": "tokensForSale", "type": "uint256" },
        { "name": "tokensSold", "type": "uint256" },
        { "name": "ethReserve", "type": "uint256" },
        { "name": "currentPrice", "type": "uint256" },
        { "name": "isActive", "type": "bool" },
        { "name": "creator", "type": "address" },
        { "name": "createdAt", "type": "uint256" }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "marketExists",
      "inputs": [
        { "name": "bondId", "type": "uint256" }
      ],
      "outputs": [
        { "name": "", "type": "bool" }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "buyTokens",
      "inputs": [
        { "name": "bondId", "type": "uint256" },
        { "name": "minTokensOut", "type": "uint256" }
      ],
      "outputs": [],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "sellTokens",
      "inputs": [
        { "name": "bondId", "type": "uint256" },
        { "name": "tokenAmount", "type": "uint256" }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "getTokenBalance",
      "inputs": [
        { "name": "bondId", "type": "uint256" },
        { "name": "user", "type": "address" }
      ],
      "outputs": [
        { "name": "", "type": "uint256" }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getBondTokenContract",
      "inputs": [
        { "name": "bondId", "type": "uint256" }
      ],
      "outputs": [
        { "name": "", "type": "address" }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "emergencyPauseMarket",
      "inputs": [
        { "name": "bondId", "type": "uint256" }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "emergencyUnpauseMarket",
      "inputs": [
        { "name": "bondId", "type": "uint256" }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "closeMarketByFactory",
      "inputs": [
        { "name": "bondId", "type": "uint256" }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "previewBuyCost",
      "inputs": [
        { "name": "bondId", "type": "uint256" },
        { "name": "tokenAmount", "type": "uint256" }
      ],
      "outputs": [
        { "name": "totalCost", "type": "uint256" },
        { "name": "feeAmount", "type": "uint256" }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "previewSellRefund",
      "inputs": [
        { "name": "bondId", "type": "uint256" },
        { "name": "tokenAmount", "type": "uint256" }
      ],
      "outputs": [
        { "name": "totalRefund", "type": "uint256" },
        { "name": "feeAmount", "type": "uint256" },
        { "name": "userReceives", "type": "uint256" }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getTokenPrice",
      "inputs": [
        { "name": "tokenNumber", "type": "uint256" }
      ],
      "outputs": [
        { "name": "", "type": "uint256" }
      ],
      "stateMutability": "pure"
    },
    {
      "type": "function",
      "name": "getContractBalance",
      "inputs": [],
      "outputs": [
        { "name": "", "type": "uint256" }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "tokenNumberToWei",
      "inputs": [
        { "name": "tokenNumber", "type": "uint256" }
      ],
      "outputs": [
        { "name": "", "type": "uint256" }
      ],
      "stateMutability": "pure"
    },
    {
      "type": "function",
      "name": "weiToTokenNumber",
      "inputs": [
        { "name": "weiAmount", "type": "uint256" }
      ],
      "outputs": [
        { "name": "", "type": "uint256" }
      ],
      "stateMutability": "pure"
    }
  ] as const
  

// ERC721 ABI for NFT approvals
export const ERC721_ABI = [
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      { "name": "to", "type": "address" },
      { "name": "tokenId", "type": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setApprovalForAll",
    "inputs": [
      { "name": "operator", "type": "address" },
      { "name": "approved", "type": "bool" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isApprovedForAll",
    "inputs": [
      { "name": "owner", "type": "address" },
      { "name": "operator", "type": "address" }
    ],
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ownerOf",
    "inputs": [{ "name": "tokenId", "type": "uint256" }],
    "outputs": [{ "name": "", "type": "address" }],
    "stateMutability": "view"
  }
] as const