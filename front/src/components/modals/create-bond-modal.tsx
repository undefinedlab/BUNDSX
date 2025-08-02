'use client'

import { useState, useEffect } from 'react'
import { X, Package, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useBondCreation } from '@/hooks/useBondCreation'

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

interface CreateBondModalProps {
  isOpen: boolean
  onClose: () => void
  selectedNFTs: NFT[]
  onBondCreated: () => void
}

export function CreateBondModal({ isOpen, onClose, selectedNFTs, onBondCreated }: CreateBondModalProps) {
  const [bondName, setBondName] = useState('')
  const [description, setDescription] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  
  const {
    createBond,
    isCreating,
    error,
    currentStep,
    isApprovalPending,
    isApprovalSuccess,
    isBondCreationPending,
    isBondCreationSuccess,
    reset
  } = useBondCreation()

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setBondName('')
      setDescription('')
      setShowSuccess(false)
      reset()
    }
  }, [isOpen, reset])

  // Handle bond creation success
  useEffect(() => {
    if (isBondCreationSuccess) {
      setShowSuccess(true)
    }
  }, [isBondCreationSuccess])

  const handleCreateBond = async () => {
    if (!bondName.trim()) {
      return
    }

    const success = await createBond({
      selectedNFTs,
      bondName: bondName.trim(),
      description: description.trim()
    })

    if (!success) {
      // Error is handled by the hook
      return
    }
  }

  const handleClose = () => {
    if (!isCreating) {
      onClose()
    }
  }

  const handleSuccessOk = () => {
    onBondCreated()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-800">Create Bond</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isCreating}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Success State */}
          {showSuccess ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Bond Created Successfully!</h3>
                <p className="text-sm text-gray-600">
                  Your bond "{bondName}" has been created with {selectedNFTs.length} NFT(s).
                </p>
              </div>
              <div className="pt-4">
                <button
                  onClick={handleSuccessOk}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  OK
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Selected NFTs Preview */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Selected NFTs ({selectedNFTs.length})</h3>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {selectedNFTs.map((nft) => (
                    <div key={nft.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <img
                        src={nft.image || `https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png`}
                        alt={nft.name}
                        className="w-8 h-8 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{nft.name}</p>
                        <p className="text-xs text-gray-500 truncate">{nft.collection}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bond Details Form */}
              {!isCreating && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="bondName" className="block text-sm font-medium text-gray-700 mb-2">
                      Bond Name *
                    </label>
                    <input
                      id="bondName"
                      type="text"
                      value={bondName}
                      onChange={(e) => setBondName(e.target.value)}
                      placeholder="Enter bond name..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      maxLength={50}
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Enter bond description (optional)..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      maxLength={200}
                    />
                  </div>
                </div>
              )}

              {/* Progress Steps */}
              {isCreating && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      currentStep === 'approving' ? 'bg-blue-600' : 'bg-green-600'
                    }`}>
                      {currentStep === 'approving' && isApprovalPending ? (
                        <Loader2 className="h-4 w-4 text-white animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <span className="text-sm font-medium">
                      {currentStep === 'approving' ? 'Approving NFTs...' : 'NFTs Approved'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      currentStep === 'creating' ? 'bg-blue-600' : currentStep === 'complete' ? 'bg-green-600' : 'bg-gray-300'
                    }`}>
                      {currentStep === 'creating' && isBondCreationPending ? (
                        <Loader2 className="h-4 w-4 text-white animate-spin" />
                      ) : currentStep === 'complete' ? (
                        <CheckCircle className="h-4 w-4 text-white" />
                      ) : (
                        <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      )}
                    </div>
                    <span className="text-sm font-medium">
                      {currentStep === 'creating' ? 'Creating Bond...' : currentStep === 'complete' ? 'Bond Created!' : 'Create Bond'}
                    </span>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleClose}
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBond}
                  disabled={isCreating || !bondName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Bond'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
} 