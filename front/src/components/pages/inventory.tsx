'use client'

import { useState, useEffect } from 'react'
import { useReadContract } from 'wagmi'
import { CONTRACT_ADDRESSES } from '../../lib/contracts'
import { Address } from 'viem'
import { Loader2, ExternalLink, Image as ImageIcon } from 'lucide-react'

// Import BondFactory ABI
const BOND_FACTORY_ABI = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "bondId",
        "type": "uint256"
      }
    ],
    "name": "getBondAssets",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "contractAddress",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "tokenId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isERC1155",
            "type": "bool"
          }
        ],
        "internalType": "struct BondFactory.NFTAsset[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const

// ERC721 Metadata ABI
const ERC721_METADATA_ABI = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "tokenURI",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const

// Define NFTAsset type to match the contract struct
interface NFTAsset {
  contractAddress: Address
  tokenId: bigint
  amount: bigint
  isERC1155: boolean
}

interface NFTMetadata {
  name?: string
  description?: string
  image?: string
  attributes?: Array<{
    trait_type: string
    value: string | number
  }>
}

interface EnrichedNFTAsset extends NFTAsset {
  metadata?: NFTMetadata
  imageUrl?: string
  name?: string
  loading?: boolean
  error?: string
}

interface InventoryProps {
  bondId: number
}

export default function Inventory({ bondId }: InventoryProps) {
  const [assets, setAssets] = useState<EnrichedNFTAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Call getBondAssets from BondFactory contract
  const { data, isLoading, isError } = useReadContract({
    address: CONTRACT_ADDRESSES.BOND_FACTORY,
    abi: BOND_FACTORY_ABI,
    functionName: 'getBondAssets',
    args: [BigInt(bondId)],
  })

  // Helper function to fetch NFT metadata using OpenSea API
  const fetchNFTMetadata = async (asset: NFTAsset): Promise<EnrichedNFTAsset> => {
    try {
      // Use OpenSea API to fetch specific NFT metadata
      const response = await fetch(`https://api.opensea.io/api/v2/chain/base/contract/${asset.contractAddress}/nfts/${asset.tokenId.toString()}`, {
        headers: {
          'accept': 'application/json',
          'x-api-key': '171864f3dfae4d52874064078bf0a5d8', // Use the same API key as in assetsfunc.js
        },
      });
      
      if (!response.ok) {
        throw new Error(`OpenSea API error: ${response.status}`);
      }
      
      const data = await response.json();
      const nft = data.nft;
      
      if (nft) {
        // Extract image URL from OpenSea response
        let imageUrl = '';
        if (nft.image_url) {
          imageUrl = nft.image_url;
        } else if (nft.metadata && nft.metadata.image) {
          imageUrl = nft.metadata.image;
        }
        
        // Handle IPFS URLs
        if (imageUrl && imageUrl.startsWith('ipfs://')) {
          imageUrl = `https://ipfs.io/ipfs/${imageUrl.replace('ipfs://', '')}`;
        }
        
        const name = nft.name || nft.metadata?.name || `Token #${asset.tokenId.toString()}`;
        
        return {
          ...asset,
          imageUrl: imageUrl || 'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
          name,
          metadata: {
            name,
            image: imageUrl,
            description: nft.metadata?.description
          }
        };
      }
      
      // If no NFT data found, return with placeholder
      return {
        ...asset,
        imageUrl: 'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
        name: `Token #${asset.tokenId.toString()}`,
        metadata: {
          name: `Token #${asset.tokenId.toString()}`
        }
      };
    } catch (err) {
      console.error('Error fetching NFT metadata from OpenSea:', err);
      
      // Return asset with fallback values
      return {
        ...asset,
        imageUrl: 'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
        name: `Token #${asset.tokenId.toString()}`,
        error: 'Failed to load metadata'
      };
    }
  };

  // Fetch metadata for all assets
  useEffect(() => {
    if (isLoading) {
      setLoading(true);
      return;
    }

    if (isError) {
      setError('Failed to load bond assets');
      setLoading(false);
      return;
    }

    if (data) {
      // Initialize with basic asset data
      const initialAssets = data.map(asset => ({
        ...asset,
        loading: true
      }));
      
      setAssets(initialAssets);
      setLoading(false);
      
      // Then fetch metadata for each asset
      const fetchAllMetadata = async () => {
        try {
          // Process assets in batches to avoid overwhelming the API
          const batchSize = 3;
          const enrichedAssets = [...initialAssets]; // Start with initial assets
          
          for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            console.log(`Fetching metadata for assets ${i+1} to ${i+batch.length} of ${data.length}`);
            
            // Process batch in parallel
            const batchResults = await Promise.all(
              batch.map(async (asset) => {
                try {
                  // Try to fetch real metadata
                  return await fetchNFTMetadata(asset);
                } catch (err) {
                  console.error(`Error fetching metadata for asset ${asset.tokenId}:`, err);
                  
                  // Fallback to placeholder if metadata fetch fails
                  return {
                    ...asset,
                    imageUrl: 'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
                    name: `${asset.isERC1155 ? 'ERC1155' : 'ERC721'} #${asset.tokenId.toString()}`,
                    loading: false
                  };
                }
              })
            );
            
            // Update the corresponding assets in our array
            batchResults.forEach((result, index) => {
              enrichedAssets[i + index] = {
                ...result,
                loading: false
              };
            });
            
            // Update state after each batch to show progress
            setAssets([...enrichedAssets]);
            
            // Small delay to avoid overwhelming the API
            if (i + batchSize < data.length) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        } catch (err) {
          console.error('Error fetching metadata:', err);
        }
      };
      
      fetchAllMetadata();
    }
  }, [data, isLoading, isError]);

  // Helper function to truncate address
  const truncateAddress = (address: Address): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
        <span>Loading assets...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 rounded-lg text-red-700">
        <p>{error}</p>
      </div>
    );
  }

  if (!assets || assets.length === 0) {
    return (
      <div className="p-4 border border-gray-200 bg-gray-50 rounded-lg text-gray-500">
        <p>No assets found for this bond</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Bond Assets</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {assets.map((asset, index) => (
          <div 
            key={index} 
            className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Image container with fixed height */}
            <div className="h-48 bg-gray-100 relative">
              {asset.loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : asset.imageUrl ? (
                <img 
                  src={asset.imageUrl} 
                  alt={asset.name || `NFT #${asset.tokenId.toString()}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback if image fails to load
                    (e.target as HTMLImageElement).src = 'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png';
                  }}
                />
              ) : (
                <img 
                  src="https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png"
                  alt={`Token #${asset.tokenId.toString()}`}
                  className="w-full h-full object-cover"
                />
              )}
              
              {/* Badge for ERC type */}
              <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${
                asset.isERC1155 ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
              }`}>
                {asset.isERC1155 ? 'ERC1155' : 'ERC721'}
              </div>
              
              {/* Amount badge for ERC1155 */}
              {asset.isERC1155 && asset.amount > BigInt(1) && (
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black bg-opacity-70 rounded-full text-xs font-medium text-white">
                  x{asset.amount.toString()}
                </div>
              )}
            </div>
            
            {/* NFT details */}
            <div className="p-3">
              <h4 className="font-medium text-sm truncate" title={asset.name || `Token #${asset.tokenId.toString()}`}>
                {asset.name || `Token #${asset.tokenId.toString()}`}
              </h4>
              
              <div className="mt-1 flex items-center text-xs text-gray-500">
                <span className="truncate" title={asset.contractAddress}>
                  {truncateAddress(asset.contractAddress)}
                </span>
                <a 
                  href={`https://basescan.org/token/${asset.contractAddress}?a=${asset.tokenId.toString()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-blue-600 hover:text-blue-800"
                  title="View on Basescan"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              
              <div className="mt-1 text-xs">
                ID: {asset.tokenId.toString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}