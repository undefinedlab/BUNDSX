import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'

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

interface AssetData {
  asset_contract?: {
    address: string
    name: string
  }
  token?: {
    asset_contract?: {
      address: string
      name: string
    }
    name: string
    image_url: string
    token_id: string
  }
  name: string
  image_url: string
  token_id: string
  collection_name: string
  collection_slug: string
  slug: string
  max_offer?: string
  maxOffer?: string
  max_offer_bidder?: string
  maxOfferBidder?: string
}

interface AssetsStats {
  totalNFTs: number
  totalHighestBids: number
  totalBonds: number
  lastFetched: string | null
  cacheStatus: string | null
}

export function useNFTs() {
  const { address } = useAccount()
  const [nfts, setNfts] = useState<NFT[]>([])
  const [stats, setStats] = useState<AssetsStats>({
    totalNFTs: 0,
    totalHighestBids: 0,
    totalBonds: 0,
    lastFetched: null,
    cacheStatus: null,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNFTs = useCallback(async () => {
    if (!address) return

    setIsLoading(true)
    setError(null)

    let ethereumNFTs: NFT[] = []
    let baseNFTs: NFT[] = []
    let hasError = false

    try {
      // Fetch from Ethereum (chainId: 1)
      try {
        console.log('Fetching Ethereum NFTs for address:', address)
        const ethereumResponse = await fetch(`http://localhost:3003/api/nft/tokens/${address}?chainId=1&limit=50`)
        console.log('Ethereum response status:', ethereumResponse.status)
        if (ethereumResponse.ok) {
          const ethereumData = await ethereumResponse.json()
          console.log('Ethereum data:', ethereumData)
          if (ethereumData.error) {
            console.error('Error in Ethereum NFT response:', ethereumData.error)
            hasError = true
          } else {
            ethereumNFTs = (ethereumData.assets || []).map((asset: AssetData) => ({
              id: `eth-${asset.asset_contract?.address || asset.token?.asset_contract?.address}-${asset.token_id || asset.token?.token_id}`,
              name: asset.name || asset.token?.name || 'Unnamed NFT',
              image: asset.image_url || asset.token?.image_url || null,
              collection: asset.collection_name || asset.asset_contract?.name || asset.token?.asset_contract?.name || 'Unknown Collection',
              floorPrice: 0,
              chain: 'ethereum' as const,
              tokenId: asset.token_id || asset.token?.token_id || '0',
              contractAddress: asset.asset_contract?.address || asset.token?.asset_contract?.address || '',
              maxOffer: asset.max_offer || asset.maxOffer,
              maxOfferBidder: asset.max_offer_bidder || asset.maxOfferBidder,
              slug: asset.collection_slug || asset.slug
            }))
          }
        }
      } catch (ethError) {
        console.error('Error fetching Ethereum NFTs:', ethError)
        hasError = true
      }

      // Fetch from Base (chainId: 8453)
      try {
        console.log('Fetching Base NFTs for address:', address)
        const baseResponse = await fetch(`http://localhost:3003/api/nft/tokens/${address}?chainId=8453&limit=50`)
        console.log('Base response status:', baseResponse.status)
        if (baseResponse.ok) {
          const baseData = await baseResponse.json()
          console.log('Base data:', baseData)
          if (baseData.error) {
            console.error('Error in Base NFT response:', baseData.error)
            hasError = true
          } else {
            baseNFTs = (baseData.assets || []).map((asset: AssetData) => ({
              id: `base-${asset.asset_contract?.address || asset.token?.asset_contract?.address}-${asset.token_id || asset.token?.token_id}`,
              name: asset.name || asset.token?.name || 'Unnamed NFT',
              image: asset.image_url || asset.token?.image_url || null,
              collection: asset.collection_name || asset.asset_contract?.name || asset.token?.asset_contract?.name || 'Unknown Collection',
              floorPrice: 0,
              chain: 'base' as const,
              tokenId: asset.token_id || asset.token?.token_id || '0',
              contractAddress: asset.asset_contract?.address || asset.token?.asset_contract?.address || '',
              maxOffer: asset.max_offer || asset.maxOffer,
              maxOfferBidder: asset.max_offer_bidder || asset.maxOfferBidder,
              slug: asset.collection_slug || asset.slug
            }))
          }
        }
      } catch (baseError) {
        console.error('Error fetching Base NFTs:', baseError)
        hasError = true
      }

      const allNFTs = [...ethereumNFTs, ...baseNFTs]
      setNfts(allNFTs)

      const totalHighestBids = allNFTs.reduce((sum, nft) => {
        return sum + (nft.maxOffer ? parseFloat(nft.maxOffer) : 0)
      }, 0)

      setStats(prev => ({
        ...prev,
        totalNFTs: allNFTs.length,
        totalHighestBids,
        lastFetched: new Date().toISOString(),
        cacheStatus: 'fresh'
      }))

      if (hasError && allNFTs.length === 0) {
        setError('Failed to fetch NFTs from both networks. Please try again.')
      }

    } catch (error) {
      console.error('Error fetching NFTs:', error)
      setError('Failed to fetch NFTs. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (address) {
      fetchNFTs()
    }
  }, [fetchNFTs, address])

  return {
    nfts,
    stats,
    isLoading,
    error,
    fetchNFTs
  }
} 