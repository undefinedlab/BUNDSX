'use client'

import { useState } from 'react'
import { Package, RefreshCw, ExternalLink, Calendar, Coins, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { useBonds, Bond } from '../../hooks/useBonds'

interface BondsTabProps {
  onBondRedeemed?: () => void
}

export function BondsTab({ onBondRedeemed }: BondsTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'assetCount'>('createdAt')
  
  const { bonds, isBondsLoading, refetchBonds } = useBonds()

  const filteredBonds = bonds.filter(bond => {
    const matchesSearch = bond.bondName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bond.description.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const sortedBonds = [...filteredBonds].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.bondName.localeCompare(b.bondName)
      case 'createdAt':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'assetCount':
        return b.assetCount - a.assetCount
      default:
        return 0
    }
  })

  const handleRefresh = () => {
    refetchBonds()
  }

  if (isBondsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading bonds...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-800">Your Bonds</h3>
          <span className="text-sm text-gray-500">({sortedBonds.length} bonds)</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isBondsLoading}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isBondsLoading ? 'animate-spin' : ''}`} />
            {isBondsLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search bonds by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'createdAt' | 'assetCount')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="createdAt">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="assetCount">Sort by Assets</option>
          </select>
        </div>
      </div>

      {/* Bonds Grid */}
      {sortedBonds.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-16 w-16 mx-auto mb-4 opacity-50 text-gray-400" />
          <p className="text-gray-600">No bonds found</p>
          <p className="text-sm text-gray-500 mt-2">Create your first bond by selecting NFTs from the NFTs tab</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedBonds.map((bond) => (
            <div
              key={bond.bondId}
              className={`border rounded-xl p-4 transition-all hover:shadow-lg ${
                bond.isRedeemed 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Bond Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-800 mb-1 truncate">{bond.bondName}</h4>
                  <p className="text-sm text-gray-600 truncate">{bond.description || 'No description'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {bond.isRedeemed ? (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-xs font-medium">Redeemed</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-blue-600">
                      <Clock className="h-4 w-4" />
                      <span className="text-xs font-medium">Active</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bond Details */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Bond ID:</span>
                  <span className="font-mono text-gray-800">#{bond.bondId}</span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Assets:</span>
                  <div className="flex items-center gap-1">
                    <Coins className="h-3 w-3 text-gray-500" />
                    <span className="font-medium">{bond.assetCount}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Created:</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-gray-500" />
                    <span>{new Date(bond.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Error State */}
              {bond.error && (
                <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg mb-3">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <p className="text-xs text-red-700">Failed to load bond data</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <a
                  href={`https://basescan.org/address/${bond.bondNFTContract}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="h-3 w-3" />
                  View on BaseScan
                </a>
                
                {!bond.isRedeemed && (
                  <button
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    disabled={bond.error}
                  >
                    Redeem
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 