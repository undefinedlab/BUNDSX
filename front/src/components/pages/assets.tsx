'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Coins, Wallet, Package, DollarSign, TrendingUp, ExternalLink } from 'lucide-react'
import { NFTsTab } from '../tabs/nfts-tab'
import { BondsTab } from '../tabs/bonds-tab'
import { useNFTs } from '../../hooks/useNFTs'

interface NFT {
  id: string
  name: string
  image: string
  collection: string
  floorPrice: number
  chain: 'ethereum' | 'base'
  tokenId: string
  contractAddress: string
  selected?: boolean
  maxOffer?: string
  maxOfferBidder?: string
  slug?: string
}

interface AssetsProps {
  selectedNFTs: NFT[]
  onSelectedNFTsChange: (nfts: NFT[]) => void
}

export function Assets({ selectedNFTs, onSelectedNFTsChange }: AssetsProps) {
  const { address, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<'nfts' | 'bonds' | 'tokens'>('nfts')
  const [isMounted, setIsMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Use the NFT hook to get real data
  const { nfts, stats: nftStats, isLoading: nftLoading, error: nftError } = useNFTs()

  // Calculate stats from actual NFT data
  const stats = {
    totalNFTs: nfts.length,
    totalBonds: 3, // Mock for now
    totalHighestBids: nfts.reduce((sum, nft) => sum + (nft.maxOffer ? parseFloat(nft.maxOffer) : 0), 0)
  }



  useEffect(() => {
    setIsMounted(true)
  }, [])

  const toggleNFTSelection = (nft: NFT) => {
    const isSelected = selectedNFTs.some(selected => selected.id === nft.id)

    if (isSelected) {
      onSelectedNFTsChange(selectedNFTs.filter(selected => selected.id !== nft.id))
    } else {
      onSelectedNFTsChange([...selectedNFTs, nft])
    }
  }

  const handleBondCreated = () => {
    // Mock bond creation success
    alert('Bond created successfully!')
  }

  if (!isMounted) {
    return null
  }

  if (!isConnected) {
    return (
      <div className="backdrop-blur-md bg-white/80 rounded-2xl border border-gray-200 p-8 shadow-lg">
        <div className="text-center text-gray-600">
          <Wallet className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-sm">Connect your wallet to view your NFT collection and bonds</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="backdrop-blur-md bg-white/80 rounded-xl border border-gray-200 p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Coins className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-gray-600 text-sm">NFTs</p>
              <p className="text-gray-800 text-xl font-bold">{stats.totalNFTs}</p>
            </div>
          </div>
        </div>

        <div className="backdrop-blur-md bg-white/80 rounded-xl border border-gray-200 p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-gray-600 text-sm">Bonds</p>
              <p className="text-gray-800 text-xl font-bold">{stats.totalBonds}</p>
            </div>
          </div>
        </div>

        <div className="backdrop-blur-md bg-white/80 rounded-xl border border-gray-200 p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-gray-600 text-sm">Total Bids</p>
              <p className="text-gray-800 text-xl font-bold">{stats.totalHighestBids.toFixed(3)} ETH</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="backdrop-blur-md bg-white/80 rounded-2xl border border-gray-200 overflow-hidden shadow-lg">
        <div className="p-6 border-b border-gray-200">
          {/* Main Tabs */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('nfts')}
                className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'nfts'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                <Coins className="h-4 w-4 mr-2" />
                NFTs 
              </button>
              <button
                onClick={() => setActiveTab('bonds')}
                className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'bonds'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                <Package className="h-4 w-4 mr-2" />
                Bonds 
              </button>
              <button
                onClick={() => setActiveTab('tokens')}
                className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'tokens'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Tokens
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* NFTs Tab */}
          {activeTab === 'nfts' && (
            <NFTsTab
              nfts={nfts}
              selectedNFTs={selectedNFTs}
              isLoading={nftLoading}
              error={nftError}
              onToggleNFTSelection={toggleNFTSelection}
              onSelectedNFTsChange={onSelectedNFTsChange}
              onBondCreated={handleBondCreated}
            />
          )}

          {/* Bonds Tab */}
          {activeTab === 'bonds' && (
            <BondsTab onBondRedeemed={handleBondCreated} />
          )}

          {/* Tokens Tab */}
          {activeTab === 'tokens' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Your Token Holdings</h3>
              <div className="text-center text-gray-600 py-8">
                <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Token trading interface coming soon...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 