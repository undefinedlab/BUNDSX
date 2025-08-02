'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAccount, useReadContract, useReadContracts, useWriteContract } from 'wagmi'
import { ExternalLink, Loader2, Coins, AlertTriangle, Package, TrendingUp, DollarSign, RefreshCw } from 'lucide-react'
import { CONTRACT_ADDRESSES, CURVE_AMM_ABI, BOND_FACTORY_ABI } from '../../lib/contracts'
import { Address, formatEther, parseEther } from 'viem'
import MarketDetails from './market-details'

interface Market {
  bondId: number
  bondName: string
  totalSupply: bigint
  tokensForSale: bigint
  tokensSold: bigint
  ethReserve: bigint
  currentPrice: bigint
  isActive: boolean
  creator: Address
  createdAt: bigint
  tokenContract: Address
  tokensAvailable: bigint
}

interface MarketsListProps {
  onBuyTokens?: (bondId: number) => void
}

export default function MarketsList({ onBuyTokens }: MarketsListProps) {
  const [selectedMarket, setSelectedMarket] = useState<number | null>(null)
  const { address } = useAccount()
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Simple approach: check for markets with IDs 0-49
  const MAX_MARKET_IDS_TO_CHECK = 10  // Increased from 10 to 50 to catch more markets

  // Create contracts array to check which markets exist
  const marketExistsContracts = useMemo(() => {
    const contracts: any[] = []
    
    console.log('Creating contracts to check market existence for IDs 0-49')
    
    for (let bondId = 0; bondId < MAX_MARKET_IDS_TO_CHECK; bondId++) {
      contracts.push({
        address: CONTRACT_ADDRESSES.CURVE_AMM,
        abi: CURVE_AMM_ABI,
        functionName: 'isMarketActive',
        args: [bondId],
      })
    }
    return contracts
  }, [])

  // Check which markets exist
  const {
    data: marketExistsData,
    isLoading: isMarketExistsLoading,
    refetch: refetchMarketExists,
  } = useReadContracts({
    contracts: marketExistsContracts,
  })

  // Get the list of existing market IDs
  const existingMarketIds = useMemo(() => {
    if (!marketExistsData) return []
    
    const ids: number[] = []
    console.log('Checking marketExistsData:', marketExistsData)
    
    marketExistsData.forEach((result, index) => {
      const bondId = index
      console.log(`Checking bond ID ${bondId}:`, result)
      
      if (result.status === 'success' && result.result === true) {
        ids.push(bondId)
        console.log(`✅ Market ${bondId} exists`)
      } else if (result.status === 'failure') {
        console.log(`❌ Market ${bondId} check failed:`, result.error)
      } else {
        console.log(`❌ Market ${bondId} does not exist (result: ${result.result})`)
      }
    })
    
    console.log('✅ Existing market IDs found:', ids)
    return ids
  }, [marketExistsData])

  // Create contracts array for batch reading market info for existing markets
  const marketContracts = useMemo(() => {
    if (existingMarketIds.length === 0) return []
    const contracts: any[] = []
    
    console.log('Creating contracts for existing market IDs:', existingMarketIds)
    
    existingMarketIds.forEach(bondId => {
      contracts.push({
        address: CONTRACT_ADDRESSES.CURVE_AMM,
        abi: CURVE_AMM_ABI,
        functionName: 'getMarketInfo',
        args: [bondId],
      })
    })
    return contracts
  }, [existingMarketIds])

  // Batch read all market data
  const {
    data: marketData,
    isLoading: isMarketsLoading,
    refetch: refetchMarkets,
    error: marketsError
  } = useReadContracts({
    contracts: marketContracts,
    query: {
      enabled: marketContracts.length > 0,
    }
  })

  // Batch fetch token contract addresses for all markets
  const tokenContractContracts = useMemo(() => {
    if (existingMarketIds.length === 0) return []
    const contracts: any[] = []
    
    existingMarketIds.forEach(bondId => {
      contracts.push({
        address: CONTRACT_ADDRESSES.CURVE_AMM,
        abi: CURVE_AMM_ABI,
        functionName: 'getBondTokenContract',
        args: [bondId],
      })
    })
    return contracts
  }, [existingMarketIds])

  // Batch fetch bond metadata (names) for all markets
  const bondMetadataContracts = useMemo(() => {
    if (existingMarketIds.length === 0) return []
    const contracts: any[] = []
    
    existingMarketIds.forEach(bondId => {
      contracts.push({
        address: CONTRACT_ADDRESSES.BOND_FACTORY,
        abi: BOND_FACTORY_ABI,
        functionName: 'getBondMetadata',
        args: [bondId],
      })
    })
    return contracts
  }, [existingMarketIds])

  // Explicitly type tokenContractsData as wagmi result type
  const { data: tokenContractsData = [] as { status: string; result?: string }[], isLoading: isTokenContractsLoading } = useReadContracts({
    contracts: tokenContractContracts,
    query: {
      enabled: tokenContractContracts.length > 0,
    }
  })

  // Fetch bond metadata
  const { data: bondMetadataData = [] as { status: string; result?: any }[], isLoading: isBondMetadataLoading } = useReadContracts({
    contracts: bondMetadataContracts,
    query: {
      enabled: bondMetadataContracts.length > 0,
    }
  })

  // Emergency functions
  const { writeContract } = useWriteContract()

  const emergencyWithdrawETH = () => {
    writeContract({
      address: CONTRACT_ADDRESSES.CURVE_AMM,
      abi: CURVE_AMM_ABI,
      functionName: 'emergencyWithdrawETH',
    })
  }
  
  const toggleMarketActive = (bondId: number, currentState: boolean) => {
    const functionName = currentState ? 'emergencyPauseMarket' : 'emergencyUnpauseMarket'
    console.log(`Toggling market ${bondId} to ${!currentState ? 'active' : 'inactive'} using ${functionName}`)
    
    writeContract({
      address: CONTRACT_ADDRESSES.CURVE_AMM,
      abi: CURVE_AMM_ABI,
      functionName: functionName,
      args: [BigInt(bondId)]
    })
  }

  // Process market data
  useEffect(() => {
    if (!marketData || isMarketsLoading || !tokenContractsData || isTokenContractsLoading || !bondMetadataData || isBondMetadataLoading) {
      setLoading(true)
      return
    }
    setLoading(false)
    try {
      console.log('Processing market data:', { 
        marketData, 
        tokenContractsData,
        marketDataLength: marketData?.length || 0,
        existingMarketIds
      });
      
      const processedMarkets: Market[] = []
      marketData.forEach((result, index) => {
        const bondId = existingMarketIds[index]
        console.log(`Processing market ${bondId}:`, result);
        console.log(`Result status: ${result.status}, Result type: ${typeof result.result}, Is array: ${Array.isArray(result.result)}`);
        if (Array.isArray(result.result)) {
          console.log(`Result array length: ${result.result.length}`);
          console.log(`Result array:`, result.result);
        }
        
        if (result.status === 'success' && result.result) {
          // Handle both array and object return types
          let totalSupply, tokensForSale, tokensSold, ethReserve, currentPrice, isActive, creator, createdAt, tokenContract;
          
          if (Array.isArray(result.result)) {
            // Array format - expected to have 8 elements (getMarketInfo returns 8 values)
            if (result.result.length >= 8) {
              [
                totalSupply,
                tokensForSale,
                tokensSold,
                ethReserve,
                currentPrice,
                isActive,
                creator,
                createdAt
              ] = result.result;
            } else {
              console.log(`Warning: Market ${bondId} has incomplete data (${result.result.length} elements)`);
              // Try to extract what we can from the partial result
              totalSupply = result.result[0];
              tokensForSale = result.result.length > 1 ? result.result[1] : 0;
              tokensSold = result.result.length > 2 ? result.result[2] : 0;
              ethReserve = result.result.length > 3 ? result.result[3] : 0;
              currentPrice = result.result.length > 4 ? result.result[4] : 0;
              isActive = result.result.length > 5 ? result.result[5] : false;
              creator = result.result.length > 6 ? result.result[6] : '0x0000000000000000000000000000000000000000';
              createdAt = result.result.length > 7 ? result.result[7] : 0;
            }
          } else {
            // Not an array or unexpected format - skip this market
            console.log(`Warning: Market ${bondId} has unexpected result format:`, result.result);
            return; // Skip this market
          }
          console.log(`Market ${bondId} data:`, { 
            totalSupply, 
            tokensForSale, 
            tokensSold, 
            isActive,
            creator
          });
          
          // Get token contract address, fallback to zero address if not available
          let finalTokenContract: Address = '0x0000000000000000000000000000000000000000'
          if (tokenContractsData && tokenContractsData[index] && tokenContractsData[index].status === 'success' && typeof tokenContractsData[index].result === 'string') {
            finalTokenContract = tokenContractsData[index].result as Address
          }
          
          // Ensure tokensForSale and tokensSold are bigint
          const tokensForSaleBigInt = typeof tokensForSale === 'bigint' ? tokensForSale : BigInt(tokensForSale || 0)
          const tokensSoldBigInt = typeof tokensSold === 'bigint' ? tokensSold : BigInt(tokensSold || 0)
          
          // Calculate tokens available - log the calculation to debug
          const tokensAvailable = tokensForSaleBigInt - tokensSoldBigInt
          console.log(`Calculating tokens available: ${tokensForSaleBigInt} - ${tokensSoldBigInt} = ${tokensAvailable}`)
          
          // Get bond name from metadata
          let bondName = 'Unknown Bond'
          if (bondMetadataData && bondMetadataData[index] && bondMetadataData[index].status === 'success' && bondMetadataData[index].result) {
            const metadata = bondMetadataData[index].result
            if (Array.isArray(metadata) && metadata.length >= 1) {
              bondName = metadata[0] || 'Unknown Bond' // First element is bondName
            }
          }

          processedMarkets.push({
            bondId,
            bondName,
            totalSupply: typeof totalSupply === 'bigint' ? totalSupply : BigInt(totalSupply || 0),
            tokensForSale: tokensForSaleBigInt,
            tokensSold: tokensSoldBigInt,
            ethReserve: typeof ethReserve === 'bigint' ? ethReserve : BigInt(ethReserve || 0),
            currentPrice: typeof currentPrice === 'bigint' ? currentPrice : BigInt(currentPrice || 0),
            isActive: Boolean(isActive),
            creator: creator || '0x0000000000000000000000000000000000000000',
            createdAt: typeof createdAt === 'bigint' ? createdAt : BigInt(createdAt || 0),
            tokenContract: finalTokenContract,
            tokensAvailable
          })
          console.log(`Added market ${bondId} to processed markets`);
        } else {
          console.log(`Market ${bondId} data invalid:`, { 
            status: result.status, 
            isArray: Array.isArray(result.result),
            resultLength: Array.isArray(result.result) ? result.result.length : 'N/A'
          });
        }
      })
      console.log('Final processed markets:', processedMarkets);
      setMarkets(processedMarkets)
      setError(processedMarkets.length === 0 ? 'No markets found' : null)
    } catch (err) {
      console.error('Error processing markets:', err)
      setError(`Error processing markets: ${err}`)
      setMarkets([])
    }
  }, [marketData, isMarketsLoading, tokenContractsData, isTokenContractsLoading, existingMarketIds, bondMetadataData, isBondMetadataLoading])

  // Refresh function
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      console.log('🔄 Starting manual refresh...')
      await Promise.all([refetchMarketExists(), refetchMarkets()])
      console.log('✅ Manual refresh completed')
    } catch (error) {
      console.error('❌ Manual refresh failed:', error)
    } finally {
      setRefreshing(false)
    }
  }

  // Force refresh all data
  const forceRefresh = async () => {
    setRefreshing(true)
    try {
      console.log('🔄 Force refreshing all data...')
      // Clear any cached data by refetching everything
      await Promise.all([
        refetchMarketExists(),
        refetchMarkets()
      ])
      console.log('✅ Force refresh completed')
    } catch (error) {
      console.error('❌ Force refresh failed:', error)
    } finally {
      setRefreshing(false)
    }
  }

  // Helper functions
  const formatEthPrice = (wei: bigint) => {
    const eth = formatEther(wei)
    const num = parseFloat(eth)
    if (num < 0.0001) return '< 0.0001'
    return num.toFixed(6)
  }
  
  // Calculate cost to buy tokens based on price curve
  const calculateBuyCost = (market: Market, tokenAmount: number): bigint => {
    if (tokenAmount <= 0) return BigInt(0)
    
    let totalCost = BigInt(0)
    const tokensSold = market.tokensSold
    
    // Simple approximation based on current price
    // In a real implementation, this should match the contract's calculation exactly
    for (let i = 0; i < tokenAmount; i++) {
      const tokenNumber = tokensSold + BigInt(i) + BigInt(1)
      const price = calculateTokenPrice(tokenNumber)
      totalCost += price
    }
    
    return totalCost
  }
  
  // Calculate price for a specific token based on its position in the curve
  // This should match the contract's _calculatePrice function
  const calculateTokenPrice = (tokenNumber: bigint): bigint => {
    if (tokenNumber === BigInt(0)) return BigInt(0)
    
    const PRICE_SCALE = BigInt(1e15) // 0.001 ETH scale
    const CURVE_STEEPNESS = BigInt(1000)
    
    // Price = (n^2 * PRICE_SCALE) / CURVE_STEEPNESS
    return (tokenNumber * tokenNumber * PRICE_SCALE) / CURVE_STEEPNESS
  }

  const formatNumber = (value: bigint) => {
    return value.toLocaleString()
  }

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString()
  }

  const isLoadingAny = isMarketExistsLoading || isMarketsLoading || isBondMetadataLoading || loading

  // If a market is selected, show its details
  if (selectedMarket !== null) {
    return (
      <MarketDetails 
        bondId={selectedMarket} 
        onBack={() => setSelectedMarket(null)} 
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Curve Markets</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={forceRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Force Refresh
          </button>
        </div>
      </div>

   


      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="backdrop-blur-md bg-white/80 rounded-xl border border-gray-200 p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-gray-600 text-sm">Total Markets</p>
              <p className="text-gray-800 text-xl font-bold">{existingMarketIds.length}</p>
            </div>
          </div>
        </div>

        <div className="backdrop-blur-md bg-white/80 rounded-xl border border-gray-200 p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Coins className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-gray-600 text-sm">Active Markets</p>
              <p className="text-gray-800 text-xl font-bold">{markets.filter(m => m.isActive).length}</p>
            </div>
          </div>
        </div>

        <div className="backdrop-blur-md bg-white/80 rounded-xl border border-gray-200 p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-gray-600 text-sm">Total Volume</p>
              <p className="text-gray-800 text-xl font-bold">
                {formatEthPrice(markets.reduce((sum, m) => sum + m.ethReserve, BigInt(0)))} ETH
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Markets List */}
      <div className="backdrop-blur-md bg-white/80 rounded-2xl border border-gray-200 overflow-hidden shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold">Curve Markets</h2>
          <p className="text-sm text-gray-600">Trade fractionalized bond tokens on exponential bonding curves</p>
        </div>
        
        {isLoadingAny ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
            <p>Loading markets...</p>
          </div>
        ) : error && markets.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="mb-2">{error}</p>
            <p className="text-sm">
              {marketsError ? `Error: ${marketsError.message}` : 'Try creating a market by "pumping" a bond in the Assets tab.'}
            </p>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {markets.map((market) => (
                <div key={market.bondId} className="border rounded-lg p-4 hover:shadow-md transition-all bg-white hover:bg-gray-50 relative">
                  {/* BaseScan Link Button */}
                  <a
                    href={`https://basescan.org/address/${market.tokenContract}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="View on BaseScan"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg">{market.bondName}</h3>
                      <p className="text-sm text-gray-500">Bond #{market.bondId}</p>
                    </div>
                    <span className={`${market.isActive 
                      ? "bg-green-100 text-green-800" 
                      : "bg-red-100 text-red-800"} px-2 py-1 rounded-full text-xs font-medium`}>
                      {market.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  
                  {/* Price Chart Visual */}
                  <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Current Price</span>
                      <span className="text-lg font-bold text-blue-600">
                        {formatEthPrice(market.currentPrice)} ETH
                      </span>
                    </div>
                  </div>
                  
                  {/* Market Details */}
                  <div className="space-y-2 text-sm mb-4">
                                         <div className="flex justify-between">
                       <span className="text-gray-600">Total Supply:</span>
                       <span className="font-mono">{formatNumber(market.totalSupply / BigInt(10 ** 18))}</span>
                     </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">ETH Reserve:</span>
                      <span className="font-mono">{formatEthPrice(market.ethReserve)} ETH</span>
                    </div>
                    <div className="flex justify-between text-xs pt-2 border-t">
                      <span className="text-gray-500">Creator:</span>
                      <span className="font-mono text-gray-500 truncate" title={market.creator}>
                        {shortenAddress(market.creator)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Created:</span>
                      <span className="text-gray-500">{formatDate(market.createdAt)}</span>
                    </div>
                  </div>
                  
                  {/* Action Button */}
                  <div className="space-y-2">
                    <div className="flex flex-col space-y-2">
                      <button 
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => setSelectedMarket(market.bondId)}
                        disabled={!market.isActive}
                      >
                        {market.isActive ? 'View Market' : 'Market Inactive'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {markets.length === 0 && (
              <div className="text-center py-8 text-gray-600">
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No markets found.</p>
                <p className="text-sm mt-2">Create a market by "pumping" a bond in the Assets tab.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 