'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Package, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react'
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

interface CreateBondProps {
  selectedNFTs: NFT[]
  onBack: () => void
  onBondCreated: () => void
}

export function CreateBond({ selectedNFTs, onBack, onBondCreated }: CreateBondProps) {
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

  // Reset form when component mounts
  useEffect(() => {
    setBondName('')
    setDescription('')
    setShowSuccess(false)
    reset()
  }, [reset])

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

  const handleSuccessOk = () => {
    onBondCreated()
    onBack()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            disabled={isCreating}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">Create Bond</h1>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          {selectedNFTs.length} NFT{selectedNFTs.length !== 1 ? 's' : ''} selected
        </div>
      </div>

      {/* Success State */}
      {showSuccess ? (
        <div className="backdrop-blur-md bg-white/80 rounded-2xl border border-gray-200 p-8 shadow-lg">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">Bond Created Successfully!</h2>
              <p className="text-lg text-gray-600">
                Your bond "{bondName}" has been created with {selectedNFTs.length} NFT{selectedNFTs.length !== 1 ? 's' : ''}.
              </p>
            </div>
            <div className="pt-6">
              <button
                onClick={handleSuccessOk}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Form */}
          <div className="backdrop-blur-md bg-white/80 rounded-2xl border border-gray-200 p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Bond Details</h2>
            
            {!isCreating && (
              <div className="space-y-6">
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    maxLength={200}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={onBack}
                    disabled={isCreating}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateBond}
                    disabled={isCreating || !bondName.trim()}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Bond'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Progress Steps */}
            {isCreating && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    currentStep === 'approving' ? 'bg-blue-600' : 'bg-green-600'
                  }`}>
                    {currentStep === 'approving' && isApprovalPending ? (
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      {currentStep === 'approving' ? 'Approving NFTs...' : 'NFTs Approved'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {currentStep === 'approving' ? 'Granting permission to transfer your NFTs' : 'Your NFTs are ready to be bonded'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    currentStep === 'creating' ? 'bg-blue-600' : currentStep === 'complete' ? 'bg-green-600' : 'bg-gray-300'
                  }`}>
                    {currentStep === 'creating' && isBondCreationPending ? (
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    ) : currentStep === 'complete' ? (
                      <CheckCircle className="h-5 w-5 text-white" />
                    ) : (
                      <div className="w-3 h-3 bg-gray-400 rounded-full" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      {currentStep === 'creating' ? 'Creating Bond...' : currentStep === 'complete' ? 'Bond Created!' : 'Create Bond'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {currentStep === 'creating' ? 'Deploying bond contract and minting tokens' : currentStep === 'complete' ? 'Your bond is now live!' : 'Ready to create your bond'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>

          {/* Right Column - Selected NFTs */}
          <div className="backdrop-blur-md bg-white/80 rounded-2xl border border-gray-200 p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Selected NFTs</h2>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {selectedNFTs.map((nft) => (
                <div key={nft.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <img
                    src={nft.image || `https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png`}
                    alt={nft.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800 truncate">{nft.name}</h3>
                    <p className="text-sm text-gray-500 truncate">{nft.collection}</p>
                    <p className="text-xs text-gray-400">Token ID: {nft.tokenId}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-800">
                      {nft.floorPrice ? `${nft.floorPrice} ETH` : 'No floor price'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Bond Preview */}
            {bondName && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-medium text-blue-800 mb-2">Bond Preview</h3>
                <p className="text-sm text-blue-700">
                  <strong>Name:</strong> {bondName}
                </p>
                {description && (
                  <p className="text-sm text-blue-700 mt-1">
                    <strong>Description:</strong> {description}
                  </p>
                )}
                <p className="text-sm text-blue-700 mt-1">
                  <strong>NFTs:</strong> {selectedNFTs.length} token{selectedNFTs.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 