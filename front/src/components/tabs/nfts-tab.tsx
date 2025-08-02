'use client'

import { useState } from 'react'
import { Coins, Plus, Filter, Search, ExternalLink } from 'lucide-react'
import { useNFTs } from '../../hooks/useNFTs'
import { CreateBondModal } from '../modals/create-bond-modal'

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

interface NFTsTabProps {
  nfts: NFT[]
  selectedNFTs: NFT[]
  isLoading: boolean
  error: string | null
  onToggleNFTSelection: (nft: NFT) => void
  onSelectedNFTsChange: (nfts: NFT[]) => void
  onBondCreated: () => void
}

export function NFTsTab({
  nfts,
  selectedNFTs,
  isLoading: externalLoading,
  error: externalError,
  onToggleNFTSelection,
  onSelectedNFTsChange,
  onBondCreated
}: NFTsTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedChain, setSelectedChain] = useState<'all' | 'ethereum' | 'base'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'floorPrice' | 'collection'>('name')
  const [isCreateBondModalOpen, setIsCreateBondModalOpen] = useState(false)

  // Use the hook to fetch real NFT data
  const { nfts: hookNFTs, stats, isLoading: hookLoading, error: hookError, fetchNFTs } = useNFTs()

  // Use hook data if available, otherwise fall back to props
  const displayNFTs = hookNFTs.length > 0 ? hookNFTs : nfts
  const isLoading = hookLoading || externalLoading
  const error = hookError || externalError

  const filteredNFTs = displayNFTs.filter(nft => {
    // Hide unnamed/unknown collections
    const isUnknownCollection = !nft.collection || 
                               nft.collection.trim() === '' || 
                               nft.collection.toLowerCase().includes('unknown') ||
                               nft.collection.toLowerCase().includes('unnamed') ||
                               nft.collection.toLowerCase().includes('untitled') ||
                               nft.collection === 'Unknown' ||
                               nft.collection === 'Unnamed' ||
                               nft.collection === 'Untitled'
    
    if (isUnknownCollection) return false
    
    const matchesSearch = nft.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         nft.collection.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesChain = selectedChain === 'all' || nft.chain === selectedChain
    return matchesSearch && matchesChain
  })

  const sortedNFTs = [...filteredNFTs].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'floorPrice':
        return b.floorPrice - a.floorPrice
      case 'collection':
        return a.collection.localeCompare(b.collection)
      default:
        return 0
    }
  })

  const handleCreateBond = () => {
    if (selectedNFTs.length === 0) {
      alert('Please select at least one NFT to create a bond')
      return
    }
    setIsCreateBondModalOpen(true)
  }

  const handleBondCreated = () => {
    onBondCreated()
    onSelectedNFTsChange([]) // Clear selection after bond creation
  }

  const handleSelectAll = () => {
    if (selectedNFTs.length === sortedNFTs.length) {
      onSelectedNFTsChange([])
    } else {
      onSelectedNFTsChange(sortedNFTs)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading NFTs...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-2">Error loading NFTs</p>
        <p className="text-gray-600 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-800">Your NFT Collection</h3>
          <span className="text-sm text-gray-500">({sortedNFTs.length} items)</span>
          {stats && (
            <span className="text-xs text-gray-400">
              Last updated: {stats.lastFetched ? new Date(stats.lastFetched).toLocaleTimeString() : 'Never'}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={fetchNFTs}
            disabled={isLoading}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={handleSelectAll}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {selectedNFTs.length === sortedNFTs.length ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={handleCreateBond}
            disabled={selectedNFTs.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Bond ({selectedNFTs.length})
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search NFTs or collections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={selectedChain}
            onChange={(e) => setSelectedChain(e.target.value as 'all' | 'ethereum' | 'base')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Chains</option>
            <option value="ethereum">Ethereum</option>
            <option value="base">Base</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'floorPrice' | 'collection')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="name">Sort by Name</option>
            <option value="floorPrice">Sort by Floor Price</option>
            <option value="collection">Sort by Collection</option>
          </select>
        </div>
      </div>

      {/* NFT Grid */}
      {sortedNFTs.length === 0 ? (
        <div className="text-center py-12">
          <Coins className="h-16 w-16 mx-auto mb-4 opacity-50 text-gray-400" />
          <p className="text-gray-600">No NFTs found matching your criteria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedNFTs.map((nft) => (
            <div
              key={nft.id}
              className={`border rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg ${
                selectedNFTs.some(selected => selected.id === nft.id)
                  ? 'border-blue-500 bg-blue-50 shadow-lg'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onToggleNFTSelection(nft)}
            >
                             <div className="relative">
                 <img
                   src={nft.image || `https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png`}
                   alt={nft.name}
                   className="w-full h-48 object-cover rounded-lg mb-3"
                   onError={(e) => {
                     e.currentTarget.src = `https://via.placeholder.com/300x300/6366f1/ffffff?text=${nft.name.charAt(0)}`
                   }}
                 />
                                       <div className="absolute top-2 left-2 bg-gray-800 text-white text-xs px-2 py-1 rounded">
                         {nft.chain}
                       </div>
                       <a
                         href={`https://${nft.chain === 'ethereum' ? 'etherscan.io' : 'basescan.org'}/token/${nft.contractAddress}?a=${nft.tokenId}`}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center transition-colors"
                         onClick={(e) => e.stopPropagation()}
                       >
                         <ExternalLink className="h-3 w-3" />
                       </a>
                       {selectedNFTs.some(selected => selected.id === nft.id) && (
                         <div className="absolute top-2 right-10 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                           <Plus className="h-4 w-4" />
                         </div>
                       )}
              </div>
              
              <h4 className="font-semibold text-gray-800 mb-1 truncate">{nft.name}</h4>
              <p className="text-sm text-gray-600 mb-2 truncate">{nft.collection}</p>
              
                                      <div className="space-y-1">
           <div className="flex justify-between items-center">
             <span className="text-sm text-gray-600">Best Bid:</span>
             <span className="text-sm font-medium text-green-600">
               {nft.maxOffer ? parseFloat(nft.maxOffer).toFixed(7) : '0.0'} ETH
             </span>
           </div>
         </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Bond Modal */}
      <CreateBondModal
        isOpen={isCreateBondModalOpen}
        onClose={() => setIsCreateBondModalOpen(false)}
        selectedNFTs={selectedNFTs}
        onBondCreated={handleBondCreated}
      />
    </div>
  )
} 