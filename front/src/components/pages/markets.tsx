'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAccount, useReadContract, useReadContracts, useWriteContract } from 'wagmi'
import { ExternalLink, Loader2, Coins, AlertTriangle, Package, TrendingUp, DollarSign, RefreshCw } from 'lucide-react'
import { CONTRACT_ADDRESSES, CURVE_AMM_ABI, BOND_FACTORY_ABI } from '../../lib/contracts'
import { Address, formatEther, parseEther } from 'viem'

interface Market {
  bondId: number
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

  // Get total markets created to know how many to check
  const { data: stats, isLoading: isStatsLoading, refetch: refetchStats } = useReadContract({
    address: CONTRACT_ADDRESSES.CURVE_AMM,
    abi: CURVE_AMM_ABI,
    functionName: 'getStats',
  })

  const totalMarketsCreated = stats?.[0] ? Number(stats[0]) : 0
  const totalVolumeETH = stats?.[1] ? formatEther(stats[1]) : '0'
  const totalFeesCollected = stats?.[2] ? formatEther(stats[2]) : '0'
  
  // Debug logging
  console.log('Stats loaded:', { totalMarketsCreated, totalVolumeETH, totalFeesCollected, stats });

  // Create contracts array for batch reading market info
  const marketContracts = useMemo(() => {
    if (totalMarketsCreated === 0) return []
    const contracts = []
    
    console.log('Creating contracts for market IDs starting from 1')
    
    for (let bondId = 1; bondId <= totalMarketsCreated; bondId++) {
      console.log(`Adding contract call for bondId ${bondId}`)
      contracts.push({
        address: CONTRACT_ADDRESSES.CURVE_AMM,
        abi: CURVE_AMM_ABI,
        functionName: 'getMarketInfo',
        args: [bondId],
      })
    }
    return contracts
  }, [totalMarketsCreated])

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
    if (totalMarketsCreated === 0) return []
    const contracts = []
    
    for (let bondId = 1; bondId <= totalMarketsCreated; bondId++) {
      contracts.push({
        address: CONTRACT_ADDRESSES.CURVE_AMM,
        abi: CURVE_AMM_ABI,
        functionName: 'getBondTokenContract',
        args: [bondId],
      })
    }
    return contracts
  }, [totalMarketsCreated])

  // Explicitly type tokenContractsData as wagmi result type
  const { data: tokenContractsData = [] as { status: string; result?: string }[], isLoading: isTokenContractsLoading } = useReadContracts({
    contracts: tokenContractContracts,
    query: {
      enabled: tokenContractContracts.length > 0,
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
    if (!marketData || isMarketsLoading || !tokenContractsData || isTokenContractsLoading) {
      setLoading(true)
      return
    }
    setLoading(false)
    try {
      console.log('Processing market data:', { 
        marketData, 
        tokenContractsData,
        marketDataLength: marketData?.length || 0
      });
      
      const processedMarkets: Market[] = []
      marketData.forEach((result, index) => {
        const bondId = index + 1
        console.log(`Processing market ${bondId}:`, result);
        
        if (result.status === 'success' && result.result) {
          // Handle both array and object return types
          let totalSupply, tokensForSale, tokensSold, ethReserve, currentPrice, isActive, creator, createdAt, tokenContract;
          
          if (Array.isArray(result.result)) {
            // Array format - expected to have 9 elements (including tokenContract)
            if (result.result.length >= 9) {
              [
                totalSupply,
                tokensForSale,
                tokensSold,
                ethReserve,
                currentPrice,
                isActive,
                creator,
                createdAt,
                tokenContract
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
              tokenContract = result.result.length > 8 ? result.result[8] : '0x0000000000000000000000000000000000000000';
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
            creator,
            tokenContract
          });
          
          // Get token contract address, fallback to zero address if not available
          let finalTokenContract: Address = '0x0000000000000000000000000000000000000000'
          if (tokenContract && typeof tokenContract === 'string') {
            finalTokenContract = tokenContract as Address
          } else if (tokenContractsData && tokenContractsData[index] && tokenContractsData[index].status === 'success' && typeof tokenContractsData[index].result === 'string') {
            finalTokenContract = tokenContractsData[index].result as Address
          }
          
          // Ensure tokensForSale and tokensSold are bigint
          const tokensForSaleBigInt = typeof tokensForSale === 'bigint' ? tokensForSale : BigInt(tokensForSale || 0)
          const tokensSoldBigInt = typeof tokensSold === 'bigint' ? tokensSold : BigInt(tokensSold || 0)
          
          // Calculate tokens available - log the calculation to debug
          const tokensAvailable = tokensForSaleBigInt - tokensSoldBigInt
          console.log(`Calculating tokens available: ${tokensForSaleBigInt} - ${tokensSoldBigInt} = ${tokensAvailable}`)
          
          processedMarkets.push({
            bondId,
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
      setError(processedMarkets.length === 0 ? 'No active markets found' : null)
    } catch (err) {
      console.error('Error processing markets:', err)
      setError(`Error processing markets: ${err}`)
      setMarkets([])
    }
  }, [marketData, isMarketsLoading, tokenContractsData, isTokenContractsLoading])

  // Refresh function
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([refetchStats(), refetchMarkets()])
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

  const isLoadingAny = isStatsLoading || isMarketsLoading || loading

  // If a market is selected, show its details (placeholder for now)
  if (selectedMarket !== null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedMarket(null)}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
          >
            ← Back to Markets
          </button>
        </div>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Market Details for Bond #{selectedMarket}</h2>
          <p className="text-gray-600">Market details component coming soon...</p>
        </div>
      </div>
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
              <p className="text-gray-800 text-xl font-bold">{totalMarketsCreated}</p>
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
              <p className="text-gray-800 text-xl font-bold">{markets.length}</p>
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
              <p className="text-gray-800 text-xl font-bold">{totalVolumeETH} ETH</p>
            </div>
          </div>
        </div>
      </div>

      {/* Markets List */}
      <div className="backdrop-blur-md bg-white/80 rounded-2xl border border-gray-200 overflow-hidden shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold">Active Curve Markets</h2>
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
                <div key={market.bondId} className="border rounded-lg p-4 hover:shadow-md transition-all bg-white hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-lg">Bond #{market.bondId}</h3>
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
                      <span className="font-mono">{formatNumber(market.totalSupply)}</span>
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
                <p>No active markets found.</p>
                <p className="text-sm mt-2">Create a market by "pumping" a bond in the Assets tab.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 