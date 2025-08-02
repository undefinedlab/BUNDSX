import { useState, useCallback } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESSES, BOND_FACTORY_ABI, BOND_NFT_ABI } from '@/lib/contracts'

export function useBondRedemption() {
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()

  // For factory redemption
  const { writeContract: writeFactory, data: factoryTx } = useWriteContract()
  // For BondNFT redemption
  const { writeContract: writeNFT, data: nftTx } = useWriteContract()

  // Wait for transaction
  const { isLoading: isPending, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // Redeem bond (direct or via BondNFT)
  const redeemBond = useCallback(async ({
    bondId,
    bondNFTContract,
    isFractionalized
  }: {
    bondId: string | number
    bondNFTContract: string
    isFractionalized: boolean
  }) => {
    setIsRedeeming(true)
    setError(null)
    setTxHash(undefined)
    try {
      if (!isFractionalized) {
        // Direct redemption via factory
        await writeFactory({
          address: CONTRACT_ADDRESSES.BOND_FACTORY,
          abi: BOND_FACTORY_ABI,
          functionName: 'redeemBond',
          args: [BigInt(bondId)]
        })
        setTxHash(factoryTx)
      } else {
        // Redemption via BondNFT contract
        await writeNFT({
          address: bondNFTContract as `0x${string}`,
          abi: BOND_NFT_ABI,
          functionName: 'claimMyNFTs',
          args: []
        })
        setTxHash(nftTx)
      }
    } catch (err: any) {
      setError(err?.message || 'Redemption failed')
    } finally {
      setIsRedeeming(false)
    }
  }, [writeFactory, writeNFT, factoryTx, nftTx])

  return {
    redeemBond,
    isRedeeming: isRedeeming || isPending,
    isSuccess,
    error,
    txHash
  }
}