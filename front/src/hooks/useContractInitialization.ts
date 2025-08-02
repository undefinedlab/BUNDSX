import { useState, useCallback } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { CONTRACT_ADDRESSES, CURVE_AMM_ABI } from '../lib/contracts'

export function useContractInitialization() {
  const [isInitializing, setIsInitializing] = useState(false)
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

  // Try normal initialization first
  const initializeBondTokenFactory = useCallback(async () => {
    setIsInitializing(true)
    setError(null)
    setTxHash(undefined)
    
    try {
      console.log('Attempting normal initialization...')
      
      writeContract({
        address: CONTRACT_ADDRESSES.CURVE_AMM,
        abi: CURVE_AMM_ABI,
        functionName: 'initializeBondTokenFactory',
        args: []
      }, {
        onSuccess: (hash) => {
          setTxHash(hash)
          console.log('Initialization transaction submitted:', hash)
        },
        onError: (error) => {
          console.error('Normal initialization failed:', error)
          // If normal initialization fails, try emergency initialization
          if (error.message.includes('Factory already has AMM')) {
            console.log('Trying emergency initialization...')
            emergencyInitialize()
          } else {
            setError(error.message || 'Initialization failed')
          }
        }
      })
      
    } catch (err: any) {
      console.error('Error during initialization:', err)
      setError(err?.message || 'Failed to initialize')
    } finally {
      setIsInitializing(false)
    }
  }, [writeContract])

  // Emergency initialization for inconsistent state
  const emergencyInitialize = useCallback(async () => {
    try {
      console.log('Attempting emergency initialization...')
      
      writeContract({
        address: CONTRACT_ADDRESSES.CURVE_AMM,
        abi: CURVE_AMM_ABI,
        functionName: 'emergencyInitialize',
        args: []
      }, {
        onSuccess: (hash) => {
          setTxHash(hash)
          console.log('Emergency initialization transaction submitted:', hash)
        },
        onError: (error) => {
          console.error('Emergency initialization failed:', error)
          setError(error.message || 'Emergency initialization failed')
        }
      })
      
    } catch (err: any) {
      console.error('Error during emergency initialization:', err)
      setError(err?.message || 'Failed to emergency initialize')
    }
  }, [writeContract])

  return {
    initializeBondTokenFactory,
    emergencyInitialize,
    isInitializing: isInitializing || isPending,
    isSuccess,
    error,
    txHash,
    isInitialized
  }
} 