import { useState, useCallback } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { CONTRACT_ADDRESSES, BOND_FACTORY_ABI, ERC721_ABI } from '@/lib/contracts'

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

interface CreateBondParams {
  selectedNFTs: NFT[]
  bondName: string
  description: string
}

export function useBondCreation() {
  const { address } = useAccount()
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<'approving' | 'creating' | 'complete'>('approving')

  // Contract write for NFT approvals
  const { writeContract: writeApproval, data: approvalHash } = useWriteContract()
  
  // Contract write for bond creation
  const { writeContract: writeBondCreation, data: bondCreationHash } = useWriteContract()

  // Wait for approval transaction
  const { isLoading: isApprovalPending, isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({
    hash: approvalHash,
  })

  // Wait for bond creation transaction
  const { isLoading: isBondCreationPending, isSuccess: isBondCreationSuccess } = useWaitForTransactionReceipt({
    hash: bondCreationHash,
  })

  // Approve NFTs for bond factory
  const approveNFTs = useCallback(async (selectedNFTs: NFT[]) => {
    if (!address) {
      setError('Wallet not connected')
      return false
    }

    try {
      setError(null)
      setCurrentStep('approving')

      // For each selected NFT, approve the bond factory to transfer it
      for (const nft of selectedNFTs) {
        await writeApproval({
          address: nft.contractAddress as `0x${string}`,
          abi: ERC721_ABI,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.BOND_FACTORY, BigInt(nft.tokenId)]
        })
      }

      return true
    } catch (err) {
      console.error('Error approving NFTs:', err)
      setError('Failed to approve NFTs for bond creation')
      return false
    }
  }, [address, writeApproval])

  // Create bond
  const createBond = useCallback(async ({ selectedNFTs, bondName, description }: CreateBondParams) => {
    if (!address) {
      setError('Wallet not connected')
      return false
    }

    if (selectedNFTs.length === 0) {
      setError('No NFTs selected')
      return false
    }

    if (!bondName.trim()) {
      setError('Bond name is required')
      return false
    }

    try {
      setIsCreating(true)
      setError(null)

      // First approve all NFTs
      const approvalSuccess = await approveNFTs(selectedNFTs)
      if (!approvalSuccess) {
        return false
      }

      // Wait for approval to complete
      if (isApprovalPending) {
        return false
      }

      // Prepare assets array for bond creation
      const assets = selectedNFTs.map(nft => ({
        contractAddress: nft.contractAddress as `0x${string}`,
        tokenId: BigInt(nft.tokenId),
        amount: BigInt(1), // For ERC721, amount is always 1
        isERC1155: false
      }))

      // Create bond
      setCurrentStep('creating')
      await writeBondCreation({
        address: CONTRACT_ADDRESSES.BOND_FACTORY,
        abi: BOND_FACTORY_ABI,
        functionName: 'createBond',
        args: [{
          assets,
          bondName,
          description
        }]
      })

      return true
    } catch (err) {
      console.error('Error creating bond:', err)
      setError('Failed to create bond')
      return false
    } finally {
      setIsCreating(false)
    }
  }, [address, approveNFTs, isApprovalPending, writeBondCreation])

  // Reset state
  const reset = useCallback(() => {
    setIsCreating(false)
    setError(null)
    setCurrentStep('approving')
  }, [])

  return {
    createBond,
    isCreating,
    error,
    currentStep,
    isApprovalPending,
    isApprovalSuccess,
    isBondCreationPending,
    isBondCreationSuccess,
    reset
  }
} 