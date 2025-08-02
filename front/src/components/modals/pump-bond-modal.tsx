'use client'

import { useState } from 'react'
import { TrendingUp, X, Loader2, Package } from 'lucide-react'
import { Bond } from '../../hooks/useBonds'
import { PumpParams } from '../../lib/types'

interface PumpBondModalProps {
  isOpen: boolean
  onClose: () => void
  bonds: Bond[]
  onPumpBond: (bondId: string, bondNFTContract: string, params: PumpParams) => Promise<void>
  isPumping: boolean
}

export function PumpBondModal({ 
  isOpen, 
  onClose, 
  bonds, 
  onPumpBond, 
  isPumping 
}: PumpBondModalProps) {
  const [selectedBondForPump, setSelectedBondForPump] = useState<string | null>(null)
  const [pumpParams, setPumpParams] = useState<PumpParams>({
    totalSupply: '1000000',
    tokensForSale: '500000'
  })

  const handlePumpBond = async () => {
    if (!selectedBondForPump) return
    
    try {
      const selectedBond = bonds.find(bond => bond.bondId === selectedBondForPump)
      if (selectedBond) {
        await onPumpBond(selectedBond.bondId, selectedBond.bondNFTContract, pumpParams)
        onClose()
        setSelectedBondForPump(null)
      }
    } catch (error) {
      console.error('Error pumping bond:', error)
      alert(`Failed to fractionalize bond: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-purple-600" />
            Fractionalize Bond
          </h2>
          <button
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => {
              onClose()
              setSelectedBondForPump(null)
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          Fractionalize your bond into tradable tokens on the CurveAMM market.
        </p>
        
        {/* Bond Selection */}
        <div className="mb-6">
          <h3 className="font-medium mb-2">Select Bond to Fractionalize</h3>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {bonds.filter(bond => !bond.isRedeemed).map((bond) => (
              <div
                key={bond.bondId}
                className={`p-3 border rounded-lg cursor-pointer transition-all ${
                  selectedBondForPump === bond.bondId
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
                onClick={() => setSelectedBondForPump(bond.bondId)}
              >
                <div className="flex justify-between">
                  <div>
                    <span className="font-medium">{bond.bondName}</span>
                    {bond.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{bond.description}</p>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">{bond.assetCount} NFTs</span>
                </div>
              </div>
            ))}
            
            {bonds.filter(bond => !bond.isRedeemed).length === 0 && (
              <div className="text-center py-6 text-gray-500">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No bonds available to fractionalize</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Market Parameters */}
        {selectedBondForPump && (
          <div className="space-y-4 mb-6">
            <h3 className="font-medium">Market Parameters</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Token Supply
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={pumpParams.totalSupply}
                onChange={(e) => setPumpParams({
                  ...pumpParams,
                  totalSupply: e.target.value,
                  tokensForSale: Math.min(parseInt(e.target.value), parseInt(pumpParams.tokensForSale)).toString()
                })}
                min="1000"
                max="1000000000"
              />
              <p className="text-xs text-gray-500 mt-1">
                Total number of tokens to create (max: 1,000,000,000)
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tokens For Sale
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={pumpParams.tokensForSale}
                onChange={(e) => setPumpParams({
                  ...pumpParams,
                  tokensForSale: Math.min(parseInt(e.target.value), parseInt(pumpParams.totalSupply)).toString()
                })}
                min="1"
                max={pumpParams.totalSupply}
              />
              <p className="text-xs text-gray-500 mt-1">
                Tokens to put in the market (max: {pumpParams.totalSupply})
              </p>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-blue-700">You will receive:</h4>
              <p className="text-xl font-bold text-blue-800">
                {parseInt(pumpParams.totalSupply) - parseInt(pumpParams.tokensForSale)} tokens
              </p>
              <p className="text-xs text-blue-600 mt-1">
                You keep {((parseInt(pumpParams.totalSupply) - parseInt(pumpParams.tokensForSale)) / parseInt(pumpParams.totalSupply) * 100).toFixed(1)}% of the total supply
              </p>
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            onClick={() => {
              onClose()
              setSelectedBondForPump(null)
            }}
          >
            Cancel
          </button>
          
          <button
            disabled={!selectedBondForPump || isPumping}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            onClick={handlePumpBond}
          >
            {isPumping ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Pumping...
              </>
            ) : (
              'Launch Market'
            )}
          </button>
        </div>
      </div>
    </div>
  )
} 