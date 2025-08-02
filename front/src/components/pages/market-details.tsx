'use client'

import { useState, useEffect } from 'react'
import { useReadContract, useReadContracts, useWriteContract, useAccount } from 'wagmi'
import { Loader2, ArrowLeft, TrendingUp, TrendingDown, Package, X, RefreshCw } from 'lucide-react'
import { CONTRACT_ADDRESSES, CURVE_AMM_ABI, BOND_FACTORY_ABI } from '../../lib/contracts'
import { Address, formatEther, parseEther } from 'viem'

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

interface MarketDetailsProps {
  bondId: number
  onBack: () => void
}

interface TokenHolder {
  address: string
  balance: string
  percentage: string
  isContract?: boolean
}

export default function MarketDetails({ bondId, onBack }: MarketDetailsProps) {
  const [market, setMarket] = useState<Market | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [buyAmount, setBuyAmount] = useState<string>('1')
  const [sellAmount, setSellAmount] = useState<string>('1')
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0))
  const [estimatedBuyCost, setEstimatedBuyCost] = useState<bigint>(BigInt(0))
  const [estimatedSellValue, setEstimatedSellValue] = useState<bigint>(BigInt(0))
  const [transactionHistory, setTransactionHistory] = useState<any[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')
  const [sellStep, setSellStep] = useState<'idle' | 'approving' | 'ready' | 'selling'>('idle')
  const [showInventory, setShowInventory] = useState(false)
  
  const { writeContract } = useWriteContract()
  const { address } = useAccount()

  // Get market info
  const { data: marketInfo, isLoading: isMarketLoading, refetch: refetchMarket } = useReadContract({
    address: CONTRACT_ADDRESSES.CURVE_AMM,
    abi: CURVE_AMM_ABI,
    functionName: 'getMarketInfo',
    args: [BigInt(bondId)],
  })

  // Get token contract
  const { data: tokenContract, isLoading: isTokenLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.CURVE_AMM,
    abi: CURVE_AMM_ABI,
    functionName: 'getBondTokenContract',
    args: [BigInt(bondId)],
  })

  // Get bond metadata (name)
  const { data: bondMetadata, isLoading: isBondMetadataLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.BOND_FACTORY,
    abi: BOND_FACTORY_ABI,
    functionName: 'getBondMetadata',
    args: [BigInt(bondId)],
  })

  // Get user balance
  const { data: balance, isLoading: isBalanceLoading, refetch: refetchBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.CURVE_AMM,
    abi: CURVE_AMM_ABI,
    functionName: 'getTokenBalance',
    args: [BigInt(bondId), address as Address || '0x0000000000000000000000000000000000000000'],
    query: {
      enabled: !!tokenContract && !!address,
    }
  })

  // Process market data
  useEffect(() => {
    if (isMarketLoading || !marketInfo || isBondMetadataLoading) {
      setLoading(true)
      return
    }

    try {
      if (Array.isArray(marketInfo) && marketInfo.length >= 8) {
        const [
          totalSupply,
          tokensForSale,
          tokensSold,
          ethReserve,
          currentPrice,
          isActive,
          creator,
          createdAt
        ] = marketInfo

        // Get bond name from metadata
        let bondName = 'Unknown Bond'
        if (bondMetadata && Array.isArray(bondMetadata) && bondMetadata.length >= 1) {
          bondName = bondMetadata[0] || 'Unknown Bond'
        }

        // Create market object
        const marketData: Market = {
          bondId,
          bondName,
          totalSupply,
          tokensForSale,
          tokensSold,
          ethReserve,
          currentPrice,
          isActive,
          creator,
          createdAt,
          tokenContract: tokenContract as Address || '0x0000000000000000000000000000000000000000',
          tokensAvailable: tokensForSale - tokensSold
        }

        setMarket(marketData)
        setLoading(false)
      } else {
        setError('Invalid market data format')
        setLoading(false)
      }
    } catch (err) {
      console.error('Error processing market details:', err)
      setError(`Error loading market details: ${err}`)
      setLoading(false)
    }
  }, [marketInfo, isMarketLoading, tokenContract, bondId, bondMetadata, isBondMetadataLoading])

  // Update user balance
  useEffect(() => {
    if (balance !== undefined) {
      setUserBalance(balance)
    }
  }, [balance])

  // Calculate token price based on its position
  const calculateTokenPrice = (tokenNumber: bigint): bigint => {
    if (tokenNumber === BigInt(0)) return BigInt(0)
    
    const PRICE_SCALE = BigInt(1e15) // 0.001 ETH scale
    const CURVE_STEEPNESS = BigInt(1000)
    
    // Price = (n^2 * PRICE_SCALE) / CURVE_STEEPNESS
    return (tokenNumber * tokenNumber * PRICE_SCALE) / CURVE_STEEPNESS
  }

  // Calculate cost to buy tokens
  const calculateBuyCost = (tokenAmount: number): bigint => {
    if (!market || tokenAmount <= 0) return BigInt(0)
    
    let totalCost = BigInt(0)
    const tokensSold = market.tokensSold
    
    for (let i = 0; i < tokenAmount; i++) {
      const tokenNumber = tokensSold + BigInt(i) + BigInt(1)
      const price = calculateTokenPrice(tokenNumber)
      totalCost += price
    }
    
    return totalCost
  }

  // Calculate value from selling tokens
  const calculateSellValue = (tokenAmount: number): bigint => {
    if (!market || tokenAmount <= 0) return BigInt(0)
    
    let totalValue = BigInt(0)
    const tokensSold = market.tokensSold
    
    for (let i = 0; i < tokenAmount; i++) {
      const tokenNumber = tokensSold - BigInt(i)
      if (tokenNumber > 0) {
        const price = calculateTokenPrice(tokenNumber)
        totalValue += price
      }
    }
    
    return totalValue
  }
  
  // Calculate ETH per token (average value)
  const calculateEthPerToken = (market: Market): bigint => {
    if (market.tokensSold === BigInt(0)) return BigInt(0)
    
    // Average ETH value per token = ETH Reserve / Tokens Sold
    return market.ethReserve / market.tokensSold
  }

  // Update estimated costs when buy amount changes
  useEffect(() => {
    const amount = parseInt(buyAmount) || 0
    const cost = calculateBuyCost(amount)
    setEstimatedBuyCost(cost)
  }, [buyAmount, market])

  // Update estimated value when sell amount changes
  useEffect(() => {
    const amount = parseInt(sellAmount) || 0
    const value = calculateSellValue(amount)
    setEstimatedSellValue(value)
  }, [sellAmount, market])

  // Buy tokens
  const handleBuyTokens = () => {
    if (!market) return
    
    const amount = parseInt(buyAmount) || 0
    if (amount <= 0) return
    
    const cost = calculateBuyCost(amount)
    console.log(`Buying ${amount} tokens for approximately ${formatEther(cost)} ETH`)
    
    writeContract({
      address: CONTRACT_ADDRESSES.CURVE_AMM,
      abi: CURVE_AMM_ABI,
      functionName: 'buyTokens',
      args: [BigInt(bondId), BigInt(amount)],
      value: cost
    })
  }

  // ERC20 ABI for token approval
  const ERC20_ABI = [
    {
      "type": "function",
      "name": "approve",
      "inputs": [
        { "name": "spender", "type": "address" },
        { "name": "amount", "type": "uint256" }
      ],
      "outputs": [{ "name": "", "type": "bool" }],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "allowance",
      "inputs": [
        { "name": "owner", "type": "address" },
        { "name": "spender", "type": "address" }
      ],
      "outputs": [{ "name": "", "type": "uint256" }],
      "stateMutability": "view"
    }
  ] as const

  // Step 1: Approve tokens for selling
  const handleApproveTokens = () => {
    if (!market || !address) return
    
    const amount = parseInt(sellAmount) || 0
    if (amount <= 0 || amount > Number(userBalance)) return
    
    console.log(`Step 1: Approving ${amount} tokens for CurveAMM to spend`)
    setSellStep('approving')
    
    writeContract({
      address: market.tokenContract,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACT_ADDRESSES.CURVE_AMM, BigInt(amount)],
    })
  }

  // Step 2: Sell tokens (after approval)
  const handleSellTokens = () => {
    if (!market) return
    
    const amount = parseInt(sellAmount) || 0
    if (amount <= 0 || amount > Number(userBalance)) return
    
    const value = calculateSellValue(amount)
    console.log(`Step 2: Selling ${amount} tokens for approximately ${formatEther(value)} ETH`)
    setSellStep('selling')
    
    writeContract({
      address: CONTRACT_ADDRESSES.CURVE_AMM,
      abi: CURVE_AMM_ABI,
      functionName: 'sellTokens',
      args: [BigInt(bondId), BigInt(amount)],
    })
  }

  // Reset sell step when amount changes
  useEffect(() => {
    setSellStep('idle')
  }, [sellAmount])

  // Fetch transaction history
  const fetchTransactionHistory = async () => {
    if (!CONTRACT_ADDRESSES.CURVE_AMM) return
    
    console.log('🔍 Starting transaction history fetch...')
    console.log('Contract Address:', CONTRACT_ADDRESSES.CURVE_AMM)
    console.log('Bond ID:', bondId)
    
    setLoadingTransactions(true)
    try {
      // Use Base chain ID (8453) and filter by bondId
      const url = `http://localhost:3003/api/transactions/history/${CONTRACT_ADDRESSES.CURVE_AMM}?chainId=8453&limit=100&bondId=${bondId}`
      console.log('📡 Fetching from URL:', url)
      
      const response = await fetch(url)
      console.log('📥 Response status:', response.status)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('📊 Raw transaction data:', data)
      
      if (data.transactions) {
        // Filter transactions related to this bondId
        const bondTransactions = data.transactions.filter((tx: any) => {
          // Only include buy, sell, and market_created transactions
          const isRelevant = tx.transactionType === 'buy' || tx.transactionType === 'sell' || tx.transactionType === 'market_created'
          console.log(`🔍 Transaction ${tx.hash?.slice(0, 8) || 'unknown'}: type=${tx.transactionType}, bondId=${tx.bondId}, relevant=${isRelevant}`)
          return isRelevant
        })
        
        console.log(`✅ Filtered ${bondTransactions.length} relevant transactions from ${data.transactions.length} total`)
        console.log('📋 Bond transactions:', bondTransactions)
        
        setTransactionHistory(bondTransactions)
      } else {
        console.log('❌ No transactions field in response')
      }
    } catch (error) {
      console.error('💥 Failed to fetch transaction history:', error)
    } finally {
      setLoadingTransactions(false)
      console.log('🏁 Transaction history fetch completed')
    }
  }

  // Load transaction history when component mounts
  useEffect(() => {
    console.log('🚀 Component mounted, fetching transaction history for bondId:', bondId)
    fetchTransactionHistory()
  }, [bondId])

  // Format helpers
  const formatEthPrice = (wei: bigint) => {
    const eth = formatEther(wei)
    const num = parseFloat(eth)
    if (num < 0.0001) return '< 0.0001'
    return num.toFixed(6)
  }

  const formatNumber = (value: bigint) => {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  }

  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString()
  }

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
        <p>Loading market details...</p>
      </div>
    )
  }

  if (error || !market) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-red-500 mb-4">{error || 'Market not found'}</p>
        <button 
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Markets
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h2 className="text-2xl font-bold">{market.bondName}</h2>
          <span className="text-gray-500">(Bond #{bondId})</span>
          <span className={`${market.isActive 
            ? "bg-green-100 text-green-800" 
            : "bg-red-100 text-red-800"} px-2 py-1 rounded-full text-xs font-medium ml-2`}>
            {market.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        <div>
          <button 
            onClick={() => refetchMarket()} 
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Market info and trading */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Market Info</h3>
              <button
                onClick={() => setShowInventory(!showInventory)}
                className="flex items-center gap-2 px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                <Package className="h-4 w-4" />
                {showInventory ? 'Hide' : 'Show'} Assets
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Supply:</span>
                <span>{formatNumber(market.totalSupply)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Supply in Curve:</span>
                <span>{formatNumber(market.tokensForSale - market.tokensSold)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">ETH Reserve:</span>
                <span>{formatEthPrice(market.ethReserve)} ETH</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">ETH per Token:</span>
                <span>{formatEthPrice(calculateEthPerToken(market))} ETH</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span>{formatDate(market.createdAt)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Creator:</span>
                <a 
                  href={`https://basescan.org/address/${market.creator}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {shortenAddress(market.creator)}
                </a>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-lg font-semibold mb-2">Trading</h3>
            
            {/* Prices */}
            <div className="flex items-center justify-between text-sm mb-2">
              <div className="flex items-center">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span>Buy: <span className="text-green-600 font-medium">{formatEthPrice(market.currentPrice)} ETH</span></span>
              </div>
              <div className="flex items-center">
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                <span>Sell: <span className="text-red-600 font-medium">{formatEthPrice(calculateTokenPrice(market.tokensSold))}</span></span>
              </div>
            </div>
            
            {/* Buy/Sell Tabs with Balance on Right */}
            <div className="flex items-center justify-between border-t pt-2 mb-2">
              <div className="grid grid-cols-2 gap-2 w-2/3">
                <button
                  onClick={() => setTab('buy')}
                  className={`${tab === 'buy' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} text-xs py-1 px-3 rounded-lg transition-colors`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setTab('sell')}
                  className={`${tab === 'sell' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} text-xs py-1 px-3 rounded-lg transition-colors`}
                  disabled={userBalance <= BigInt(0)}
                >
                  Sell
                </button>
              </div>
              <div className="text-right text-xs">
                <div className="text-gray-600">Your Balance:</div>
                <div className="font-medium">{formatNumber(userBalance)}</div>
              </div>
            </div>
            
            {/* Trading Form - More Compact */}
            <div className="mt-4 pt-4 border-t">
              {tab === 'buy' ? (
                <div>
                  <div className="flex space-x-3">
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <label className="text-sm font-medium text-gray-700">Amount</label>
                      </div>
                      <div className="flex">
                        <input
                          type="number"
                          value={buyAmount}
                          onChange={(e) => setBuyAmount(e.target.value)}
                          min="1"
                          max={Number(market.tokensForSale - market.tokensSold)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-l-lg text-sm"
                          placeholder="Amount"
                        />
                        <button
                          onClick={() => setBuyAmount((Number(market.tokensForSale - market.tokensSold)).toString())}
                          className="px-3 py-2 border border-gray-300 border-l-0 rounded-r-lg text-sm hover:bg-gray-50 transition-colors"
                        >
                          Max
                        </button>
                      </div>
                    </div>
                    <div className="w-1/3">
                      <div className="mb-1">
                        <span className="text-sm font-medium text-gray-700">Confirm</span>
                      </div>
                      <button
                        onClick={handleBuyTokens}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        disabled={!market.isActive || parseInt(buyAmount) <= 0}
                      >
                        Buy
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>You will pay:</span>
                      <span className="font-medium">{formatEthPrice(estimatedBuyCost)} ETH</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex space-x-3">
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <label className="text-sm font-medium text-gray-700">Amount</label>
                      </div>
                      <div className="flex">
                        <input
                          type="number"
                          value={sellAmount}
                          onChange={(e) => setSellAmount(e.target.value)}
                          min="1"
                          max={Number(userBalance)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-l-lg text-sm"
                          placeholder="Amount"
                        />
                        <button
                          onClick={() => setSellAmount(Number(userBalance).toString())}
                          className="px-3 py-2 border border-gray-300 border-l-0 rounded-r-lg text-sm hover:bg-gray-50 transition-colors"
                        >
                          Max
                        </button>
                      </div>
                    </div>
                    <div className="w-1/3">
                      <div className="mb-1">
                        <span className="text-sm font-medium text-gray-700">Confirm</span>
                      </div>
                      {sellStep === 'idle' && (
                        <button
                          onClick={handleApproveTokens}
                          className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          disabled={!market.isActive || parseInt(sellAmount) <= 0 || parseInt(sellAmount) > Number(userBalance) || !address}
                        >
                          Approve
                        </button>
                      )}
                      
                      {sellStep === 'approving' && (
                        <button
                          disabled
                          className="w-full bg-yellow-500 opacity-75 text-white py-2 px-3 rounded-lg text-sm"
                        >
                          <Loader2 className="h-4 w-4 animate-spin mr-1 inline" />
                          Approving
                        </button>
                      )}
                      
                      {(sellStep === 'ready' || sellStep === 'selling') && (
                        <button
                          onClick={handleSellTokens}
                          className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          disabled={sellStep === 'selling'}
                        >
                          {sellStep === 'selling' ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-1 inline" />
                              Selling
                            </>
                          ) : (
                            'Sell'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>You will receive:</span>
                      <span className="font-medium">{formatEthPrice(estimatedSellValue)} ETH</span>
                    </div>
                  </div>
                  
                  {sellStep === 'approving' && (
                    <div className="mt-2">
                      <button
                        onClick={() => setSellStep('ready')}
                        className="w-full border border-gray-300 rounded-lg py-1 px-3 text-xs hover:bg-gray-50 transition-colors"
                      >
                        Approval Complete - Continue
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Token Holders Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Token Holders</h3>
            <div className="overflow-auto max-h-[400px]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* Show only real data: contract balance and current user balance */}
                  {(() => {
                    const totalSupply = Number(market.totalSupply);
                    const holders: TokenHolder[] = [];
                    
                    // Add current user if they have balance
                    if (address && userBalance > BigInt(0)) {
                      holders.push({
                        address: address,
                        balance: userBalance.toString(),
                        percentage: (Number(userBalance) / totalSupply * 100).toFixed(1)
                      });
                    }
                    
                    // Add contract as holder of remaining supply
                    const contractBalance = totalSupply - Number(userBalance);
                    if (contractBalance > 0) {
                      holders.push({
                        address: market.tokenContract,
                        balance: contractBalance.toString(),
                        percentage: (contractBalance / totalSupply * 100).toFixed(1),
                        isContract: true
                      });
                    }
                    
                    // Sort holders by balance (descending)
                    return holders.sort((a, b) => parseInt(b.balance) - parseInt(a.balance));
                  })().map((holder: TokenHolder, index: number) => (
                    <tr key={index} className={`hover:bg-gray-50 ${holder.address === address ? 'bg-blue-50' : holder.isContract ? 'bg-gray-50' : ''}`}>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-2 ${
                            holder.isContract ? 'bg-purple-500' : 
                            holder.address === address ? 'bg-blue-500' : 'bg-gray-400'
                          }`}></div>
                          <a 
                            href={`https://basescan.org/address/${holder.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
                            {holder.address === address && <span className="ml-1 text-xs text-blue-700">(You)</span>}
                            {holder.isContract && <span className="ml-1 text-xs text-purple-700">(Contract)</span>}
                          </a>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                        {holder.balance}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className={`${holder.isContract ? 'bg-purple-500' : 'bg-blue-600'} h-2 rounded-full`}
                              style={{ width: `${Math.min(100, parseFloat(holder.percentage))}%` }}
                            ></div>
                          </div>
                          {holder.percentage}%
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column - Market Activity */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Market Activity</h3>
            <div className="overflow-auto max-h-[600px]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loadingTransactions ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                        Loading transaction history...
                      </td>
                    </tr>
                  ) : transactionHistory.length > 0 ? (
                    transactionHistory.map((tx, index) => (
                      <tr key={tx.hash || index} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-2 ${
                              tx.transactionType === 'buy' ? 'bg-green-500' : 
                              tx.transactionType === 'sell' ? 'bg-red-500' : 'bg-blue-500'
                            }`}></div>
                            <div className="text-sm font-medium capitalize">{tx.transactionType.replace('_', ' ')}</div>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {new Date(parseInt(tx.timestamp) * 1000).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm">
                          {tx.ethAmount ? `${tx.ethAmount} ETH` : '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-blue-600">
                          <a 
                            href={`https://basescan.org/tx/${tx.hash}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {tx.hash ? `${tx.hash.slice(0, 6)}...${tx.hash.slice(-4)}` : '-'}
                          </a>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-sm text-gray-500">
                        No transaction history available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Modal */}
      {showInventory && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowInventory(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold flex items-center">
                <Package className="h-5 w-5 mr-2 text-blue-600" />
                Bond #{bondId} Assets
              </h2>
              <button
                onClick={() => setShowInventory(false)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="text-center py-8 text-gray-600">
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>Asset inventory component coming soon...</p>
                <p className="text-sm mt-2">This will show the NFTs locked in this bond.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 