import { useState, useCallback } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { CONTRACT_ADDRESSES, CURVE_AMM_ABI } from '../lib/contracts'
import { PumpParams } from '../lib/types'

export function useBondPump() {
  const [isPumping, setIsPumping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()

  const { writeContract } = useWriteContract()

  // Check if CurveAMM is initialized
  const { data: isInitialized } = useReadContract({
    address: CONTRACT_ADDRESSES.CURVE_AMM,
    abi: CURVE_AMM_ABI,
    functionName: 'initialized',
  })

  // Wait for transaction
  const { isLoading: isPending, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // Pump bond (fractionalize and create market)
  const pumpBond = useCallback(async ({
    bondId,
    bondNFTContract,
    params
  }: {
    bondId: string
    bondNFTContract: string
    params: PumpParams
  }) => {
    setIsPumping(true)
    setError(null)
    setTxHash(undefined)
    
    try {
      console.log('Creating market for bond:', {
        bondId,
        bondNFTContract,
        params
      })
      
      // Call the CurveAMM contract to create a market
      writeContract({
        address: CONTRACT_ADDRESSES.CURVE_AMM,
        abi: CURVE_AMM_ABI,
        functionName: 'createMarket',
        args: [
          BigInt(bondId),
          BigInt(params.totalSupply),
          BigInt(params.tokensForSale)
        ]
      }, {
        onSuccess: (hash) => {
          setTxHash(hash)
          console.log('Market creation transaction submitted:', hash)
        },
        onError: (error) => {
          console.error('Transaction failed:', error)
          let errorMessage = error.message || 'Transaction failed'
          
          // Provide more helpful error messages
          if (errorMessage.includes('Contract not initialized')) {
            errorMessage = 'CurveAMM contract is not initialized. Please contact the contract owner to initialize it.'
          } else if (errorMessage.includes('Not bond owner')) {
            errorMessage = 'You must own the bond NFT to create a market for it.'
          } else if (errorMessage.includes('Market already exists')) {
            errorMessage = 'A market already exists for this bond.'
          } else if (errorMessage.includes('Bond already redeemed')) {
            errorMessage = 'Cannot create market for a redeemed bond.'
          }
          
          setError(errorMessage)
        }
      })
      
    } catch (err: any) {
      console.error('Error creating market:', err)
      setError(err?.message || 'Failed to create market')
      throw err
    } finally {
      setIsPumping(false)
    }
  }, [writeContract])

  return {
    pumpBond,
    isPumping: isPumping || isPending,
    isSuccess,
    error,
    txHash,
    isInitialized
  }
} 