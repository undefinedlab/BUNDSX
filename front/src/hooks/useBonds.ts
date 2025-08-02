import { useState, useEffect, useCallback } from 'react'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { Address } from 'viem'
import { CONTRACT_ADDRESSES, BOND_FACTORY_ABI } from '@/lib/contracts'

export interface Bond {
  bondId: string
  creator: string
  bondNFTContract: string
  isRedeemed: boolean
  createdAt: string
  assetCount: number
  bondName: string
  description: string
  bondNumber: string
  error?: boolean
}

export function useBonds() {
  const { address } = useAccount()
  const [bonds, setBonds] = useState<Bond[]>([])
  const [isBondsLoading, setIsBondsLoading] = useState(false)
  const [isRedeeming, setIsRedeeming] = useState<Record<string, boolean>>({})

  // Fetch user bonds from contract
  const { data: userBondIds, refetch: refetchBonds } = useReadContract({
    address: CONTRACT_ADDRESSES.BOND_FACTORY,
    abi: BOND_FACTORY_ABI,
    functionName: 'getUserBonds',
    args: [(address as Address) || '0x0000000000000000000000000000000000000000' as Address],
    query: { enabled: !!address }
  })

  // Setup for multiple bond info calls
  const bondInfoCalls = userBondIds 
    ? userBondIds.map((bondId: bigint) => ({
        address: CONTRACT_ADDRESSES.BOND_FACTORY as Address,
        abi: BOND_FACTORY_ABI,
        functionName: 'getBondInfo',
        args: [bondId],
      }))
    : [];

  // Setup for multiple bond metadata calls
  const bondMetadataCalls = userBondIds 
    ? userBondIds.map((bondId: bigint) => ({
        address: CONTRACT_ADDRESSES.BOND_FACTORY as Address,
        abi: BOND_FACTORY_ABI,
        functionName: 'getBondMetadata',
        args: [bondId],
      }))
    : [];

  // Use useReadContracts to batch fetch bond info
  const { data: bondInfoResults, isLoading: isBondInfoLoading } = useReadContracts({
    contracts: bondInfoCalls,
    query: {
      enabled: !!userBondIds && userBondIds.length > 0,
    }
  })

  // Use useReadContracts to batch fetch bond metadata
  const { data: bondMetadataResults, isLoading: isBondMetadataLoading } = useReadContracts({
    contracts: bondMetadataCalls,
    query: {
      enabled: !!userBondIds && userBondIds.length > 0,
    }
  })

  // Convert bond IDs to bond objects using bond info results
  const updateBondsFromIds = useCallback(() => {
    if (!userBondIds || userBondIds.length === 0 || !bondInfoResults || !bondMetadataResults) {
      setBonds([])
      setIsBondsLoading(false)
      return
    }

    setIsBondsLoading(true)
    console.log("Bond IDs:", userBondIds.map((id: bigint) => id.toString()))
    console.log("Bond info results:", bondInfoResults)
    console.log("Bond metadata results:", bondMetadataResults)

    try {
      const bondResults = userBondIds.map((bondId: bigint, index: number) => {
        const bondInfo = bondInfoResults[index];
        const bondMetadata = bondMetadataResults[index];
        
        if (!bondInfo || bondInfo.status === 'failure') {
          console.error(`Failed to get info for bond #${bondId.toString()}`);
          return {
            bondId: bondId.toString(),
            creator: address || '0x0',
            bondNFTContract: CONTRACT_ADDRESSES.BOND_FACTORY as string,
            isRedeemed: false,
            createdAt: new Date().toISOString(),
            assetCount: 0,
            bondName: `Bond #${bondId.toString()}`,
            description: '',
            bondNumber: '',
            error: true
          };
        }
        
        const [creator, bondNFTContract, isRedeemed, createdAt, assetCount] = (bondInfo as any).result as [string, string, boolean, bigint, bigint];
        
        let bondName = `Bond #${bondId.toString()}`;
        let description = '';
        let bondNumber = '';
        
        if (bondMetadata && bondMetadata.status === 'success') {
          const [name, desc, number, totalAssets] = (bondMetadata as any).result as [string, string, string, bigint];
          bondName = name || `Bond #${bondId.toString()}`;
          description = desc || '';
          bondNumber = number || '';
        }
        
        console.log(`Bond #${bondId.toString()} data:`, {
          creator,
          bondNFTContract,
          isRedeemed,
          createdAt: createdAt.toString(),
          assetCount: assetCount.toString(),
          bondName,
          description,
          bondNumber
        });
        
        return {
          bondId: bondId.toString(),
          creator,
          bondNFTContract,
          isRedeemed,
          createdAt: new Date(Number(createdAt) * 1000).toISOString(),
          assetCount: Number(assetCount),
          bondName,
          description,
          bondNumber
        };
      });
      
      console.log("All bond details:", bondResults);
      
      setBonds(bondResults);
    } catch (error) {
      console.error("Error processing bond data:", error);
    } finally {
      setIsBondsLoading(false);
    }
  }, [userBondIds, bondInfoResults, bondMetadataResults, address]);

  // Update bonds when IDs or bond info change
  useEffect(() => {
    if (userBondIds && bondInfoResults && bondMetadataResults) {
      updateBondsFromIds();
    }
  }, [userBondIds, bondInfoResults, bondMetadataResults, updateBondsFromIds]);

  return {
    bonds,
    isBondsLoading: isBondsLoading || isBondInfoLoading || isBondMetadataLoading,
    isRedeeming,
    setIsRedeeming,
    refetchBonds,
    updateBondsFromIds
  }
} 