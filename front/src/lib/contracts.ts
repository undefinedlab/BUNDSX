import { Address } from 'viem'

// Contract addresses - Update these after deployment on Base
export const CONTRACT_ADDRESSES = {
  // These will be updated with actual deployed addresses on Base
  BOND_FACTORY: '0xC35A017D122BfD160e3A60f0c2E5b58EbBDDcf6C' as Address, // Replace with deployed Bond Factory address
} as const

// Bond Factory ABI - updated to match the actual contract
export const BOND_FACTORY_ABI = [
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
    "name": "getUserBonds",
    "inputs": [{ "name": "user", "type": "address" }],
    "outputs": [{ "name": "", "type": "uint256[]" }],
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
    "type": "event",
    "name": "BondCreated",
    "inputs": [
      { "name": "bondId", "type": "uint256", "indexed": true },
      { "name": "creator", "type": "address", "indexed": true },
      { "name": "bondNFTAddress", "type": "address", "indexed": false },
      { "name": "assets", "type": "tuple[]", "indexed": false },
      { "name": "timestamp", "type": "uint256", "indexed": false }
    ]
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