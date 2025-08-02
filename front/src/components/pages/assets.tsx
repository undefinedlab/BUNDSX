'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Coins, Wallet, Package, DollarSign, TrendingUp, ExternalLink } from 'lucide-react'
import { NFTsTab } from '../tabs/nfts-tab'
import { BondsTab } from '../tabs/bonds-tab'
import { CreateBond } from './create-bond'
import { useNFTs } from '../../hooks/useNFTs'
import { useBonds } from '../../hooks/useBonds'

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
  const [showCreateBond, setShowCreateBond] = useState(false)

  // Use the NFT hook to get real data
  const { nfts, stats: nftStats, isLoading: nftLoading, error: nftError } = useNFTs()
  
  // Use the Bonds hook to get real bond data
  const { bonds, isBondsLoading } = useBonds()

  // Calculate stats from actual data
  const stats = {
    totalNFTs: nfts.length,
    totalBonds: bonds.length,
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

  const handleCreateBond = () => {
    if (selectedNFTs.length > 0) {
      setShowCreateBond(true)
    }
  }

  const handleBondCreated = () => {
    // Reset selected NFTs after bond creation
    onSelectedNFTsChange([])
    setShowCreateBond(false)
    // You could also refresh the bonds data here
  }

  const handleBackFromCreateBond = () => {
    setShowCreateBond(false)
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

  // Show create bond page if active
  if (showCreateBond) {
    return (
      <CreateBond
        selectedNFTs={selectedNFTs}
        onBack={handleBackFromCreateBond}
        onBondCreated={handleBondCreated}
      />
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
              <p className="text-gray-800 text-xl font-bold">
                {nftLoading ? '...' : stats.totalNFTs}
              </p>
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
              <p className="text-gray-800 text-xl font-bold">
                {isBondsLoading ? '...' : stats.totalBonds}
              </p>
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
              <p className="text-gray-800 text-xl font-bold">
                {nftLoading ? '...' : `${stats.totalHighestBids.toFixed(2)} ETH`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Create Bond Button */}
      {selectedNFTs.length > 0 && (
        <div className="backdrop-blur-md bg-white/80 rounded-xl border border-gray-200 p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800">Create Bond</h3>
              <p className="text-sm text-gray-600">
                {selectedNFTs.length} NFT{selectedNFTs.length !== 1 ? 's' : ''} selected
              </p>
            </div>
            <button
              onClick={handleCreateBond}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Create Bond
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="backdrop-blur-md bg-white/80 rounded-2xl border border-gray-200 shadow-lg">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('nfts')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'nfts'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            NFTs
          </button>
          <button
            onClick={() => setActiveTab('bonds')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'bonds'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Bonds
          </button>
          <button
            onClick={() => setActiveTab('tokens')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'tokens'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Tokens
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'nfts' && (
            <NFTsTab
              nfts={nfts}
              selectedNFTs={selectedNFTs}
              onToggleNFTSelection={toggleNFTSelection}
              onSelectedNFTsChange={onSelectedNFTsChange}
              isLoading={nftLoading}
              error={nftError}
            />
          )}
          {activeTab === 'bonds' && (
            <BondsTab onBondRedeemed={() => {
              // Refresh bonds data when a bond is redeemed
              // The useBonds hook will handle the refresh automatically
            }} />
          )}
          {activeTab === 'tokens' && (
            <div className="text-center text-gray-500 py-8">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Token Trading</h3>
              <p className="text-sm">Trade your bond tokens on the marketplace</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 