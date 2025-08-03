'use client'

import { useState, useEffect, useCallback } from 'react'
import { useReadContract, useWriteContract, useAccount } from 'wagmi'
import { Loader2, ArrowLeft, TrendingUp, TrendingDown, Package, X, RefreshCw, Power } from 'lucide-react'
import { CONTRACT_ADDRESSES, CURVE_AMM_ABI, BOND_FACTORY_ABI, CURVE_AMM_EVENTS } from '../../lib/contracts'
import { Address, formatEther } from 'viem'
import { Line } from 'react-chartjs-2'
import Inventory from './inventory'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  ChartOptions
} from 'chart.js'
import 'chart.js/auto'
import 'chartjs-adapter-date-fns'
import annotationPlugin from 'chartjs-plugin-annotation'

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
)

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

interface PricePoint {
  tokenNumber: number
  price: number
  type?: 'buy' | 'sell' | 'market_created'
  timestamp?: number
  hash?: string
  ethAmount?: string
}

interface Transaction {
  hash: string
  transactionType: 'buy' | 'sell' | 'market_created'
  bondId: string
  timestamp: string
  ethAmount: string
  blockNumber: string
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
  const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')
  const [sellStep, setSellStep] = useState<'idle' | 'selling'>('idle')
  const [showInventory, setShowInventory] = useState(false)
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])
  const [curvePoints, setCurvePoints] = useState<PricePoint[]>([])
  const [isClosingMarket, setIsClosingMarket] = useState(false)
  
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
  const { data: tokenContract } = useReadContract({
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
  const { data: balance } = useReadContract({
    address: CONTRACT_ADDRESSES.CURVE_AMM,
    abi: CURVE_AMM_ABI,
    functionName: 'getTokenBalance',
    args: [BigInt(bondId), address as Address || '0x0000000000000000000000000000000000000000'],
    query: {
      enabled: !!tokenContract && !!address,
    }
  })

  // Get real buy cost from contract
  const { data: buyCostData } = useReadContract({
    address: CONTRACT_ADDRESSES.CURVE_AMM,
    abi: CURVE_AMM_ABI,
    functionName: 'previewBuyCost',
    args: [BigInt(bondId), BigInt(parseInt(buyAmount) || 1)],
    query: {
      enabled: !!market,
    }
  })

  // Get default buy cost for 1 token to show real buy price
  const { data: defaultBuyCostData } = useReadContract({
    address: CONTRACT_ADDRESSES.CURVE_AMM,
    abi: CURVE_AMM_ABI,
    functionName: 'previewBuyCost',
    args: [BigInt(bondId), BigInt(1)],
    query: {
      enabled: !!market,
    }
  })



  // Get real sell refund from contract
  const { data: sellRefundData, isLoading: isSellRefundLoading, error: sellRefundError } = useReadContract({
    address: CONTRACT_ADDRESSES.CURVE_AMM,
    abi: CURVE_AMM_ABI,
    functionName: 'previewSellRefund',
    args: [BigInt(bondId), BigInt(parseInt(sellAmount) || 1)],
    query: {
      enabled: !!market && market.isActive && market.tokensSold > BigInt(0),
    }
  })

  // Get default sell refund for 1 token to show real sell price
  const { data: defaultSellRefundData, isLoading: isDefaultSellRefundLoading, error: defaultSellRefundError } = useReadContract({
    address: CONTRACT_ADDRESSES.CURVE_AMM,
    abi: CURVE_AMM_ABI,
    functionName: 'previewSellRefund',
    args: [BigInt(bondId), BigInt(1)],
    query: {
      enabled: !!market && market.isActive && market.tokensSold > BigInt(0),
    }
  })

  // Get contract ETH balance for debugging
  const { data: contractBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.CURVE_AMM,
    abi: CURVE_AMM_ABI,
    functionName: 'getContractBalance',
    query: {
      enabled: !!market,
    }
  })



  // Debug: Log sell refund data and contract balance
  useEffect(() => {
    console.log('=== SELL REFUND DEBUG ===')
    console.log('Market state:', market ? {
      isActive: market.isActive,
      tokensSold: market.tokensSold.toString(),
      ethReserve: formatEther(market.ethReserve),
      bondId: market.bondId
    } : 'No market')
    
    console.log('Sell refund call state:', {
      isSellRefundLoading,
      sellRefundError: sellRefundError?.message,
      sellRefundData: sellRefundData ? 'Available' : 'Not available',
      sellAmount: sellAmount || '1'
    })
    
    if (sellRefundData && Array.isArray(sellRefundData) && sellRefundData.length >= 3) {
      console.log('Contract previewSellRefund data:', {
        totalRefund: formatEther(sellRefundData[0] as bigint),
        feeAmount: formatEther(sellRefundData[1] as bigint),
        userReceives: formatEther(sellRefundData[2] as bigint),
        sellAmount: sellAmount || '1'
      })
      
      // Debug: Check if the contract data makes sense
      if (market) {
        const totalRefund = sellRefundData[0] as bigint
        const userReceives = sellRefundData[2] as bigint
        console.log('Contract validation:')
        console.log(`- Total refund (${formatEther(totalRefund)} ETH) <= ETH Reserve (${formatEther(market.ethReserve)} ETH): ${totalRefund <= market.ethReserve}`)
        console.log(`- User receives (${formatEther(userReceives)} ETH) should be > 0: ${userReceives > BigInt(0)}`)
      }
    } else if (sellRefundError) {
      console.log('Sell refund error:', sellRefundError.message)
    }
    
    if (contractBalance !== undefined && market) {
      console.log('Contract ETH balance:', formatEther(contractBalance))
      console.log('Market ETH reserve:', formatEther(market.ethReserve))
      console.log('Difference (contract - reserve):', formatEther(contractBalance - market.ethReserve))
    }
    console.log('=== END SELL REFUND DEBUG ===')
  }, [sellRefundData, sellAmount, contractBalance, market, isSellRefundLoading, sellRefundError])

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

        // Generate price history data
        generatePriceHistory(marketData)
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

  // Generate price history data incorporating real transaction data
  const generatePriceHistory = useCallback((marketData: Market) => {
    console.log('Generating price history with transactions:', transactionHistory.length);
    
    const tokensSold = Number(marketData.tokensSold)
    const tokensForSale = Number(marketData.tokensForSale)
    
    // Create price history points based on transactions
    const historyPoints: PricePoint[] = []
    
    // Ensure all price points have timestamps for the time-based chart
    const now = Math.floor(Date.now() / 1000)
    
    // Simple chart logic: start from 0, go up with buys, down with sells
    if (transactionHistory.length > 0) {
      console.log('Processing transaction history for simple chart');
      
      // Sort transactions by timestamp (oldest first)
      const sortedTxs = [...transactionHistory]
        .filter(tx => tx.transactionType === 'buy' || tx.transactionType === 'sell' || tx.transactionType === 'market_created')
        .sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));
      
      console.log('Sorted transactions:', sortedTxs.length);
      
      // Start point at 0
      historyPoints.push({
        tokenNumber: 0,
        price: 0,
        timestamp: sortedTxs.length > 0 ? parseInt(sortedTxs[0].timestamp) - 3600 : Math.floor(Date.now() / 1000) - 86400
      });
      
      // Track current price (starts at 0)
      let currentPrice = 0;
      
      // Process each transaction
      for (const tx of sortedTxs) {
        if (tx.transactionType === 'market_created') {
          // Market created - set initial price
          currentPrice = 0.001; // Start at 0.001 ETH
          historyPoints.push({
            tokenNumber: 0,
            price: currentPrice,
            timestamp: parseInt(tx.timestamp),
            type: 'market_created',
            hash: tx.hash,
            ethAmount: "0.001"
          });
        } else if (tx.transactionType === 'buy') {
          // Buy transaction - price goes up linearly
          currentPrice += 0.001; // Each buy increases price by 0.001 ETH
          historyPoints.push({
            tokenNumber: historyPoints.length, // Simple counter
            price: currentPrice,
            timestamp: parseInt(tx.timestamp),
            type: 'buy',
            hash: tx.hash,
            ethAmount: tx.ethAmount || "0.001"
          });
        } else if (tx.transactionType === 'sell') {
          // Sell transaction - price goes down linearly
          currentPrice = Math.max(0.001, currentPrice - 0.001); // Each sell decreases price by 0.001 ETH, minimum 0.001
          historyPoints.push({
            tokenNumber: historyPoints.length, // Simple counter
            price: currentPrice,
            timestamp: parseInt(tx.timestamp),
            type: 'sell',
            hash: tx.hash,
            ethAmount: tx.ethAmount || "0.001"
          });
        }
      }
      
      console.log(`Generated ${historyPoints.length} simple transaction points`);
    } else {
      // No transactions - simple default curve
      const now = Math.floor(Date.now() / 1000);
      
      // Start at 0
      historyPoints.push({
        tokenNumber: 0,
        price: 0,
        timestamp: now - 86400
      });
      
      // Market created
      historyPoints.push({
        tokenNumber: 0,
        price: 0.001,
        timestamp: now - 43200,
        type: 'market_created',
        ethAmount: "0.001"
      });
      
            // Current state
      historyPoints.push({
        tokenNumber: 1,
        price: 0.002,
        timestamp: now,
        ethAmount: "0.002"
      });
    }
    
    // Sort history points by timestamp for proper time-based chart
    historyPoints.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return 0;
    });
    
    console.log(`Final chart has ${historyPoints.length} history points`);
    
    // Set the dataset
    setPriceHistory(historyPoints);
  }, [transactionHistory]) // Add dependencies

  // Calculate token price based on its position (linear curve)
  const calculateTokenPrice = (tokenNumber: bigint): bigint => {
    if (tokenNumber === BigInt(0)) return BigInt(0)
    
    const PRICE_SCALE = BigInt(1e15) // 0.001 ETH scale
    
    // Price = tokenNumber * PRICE_SCALE (linear curve)
    return tokenNumber * PRICE_SCALE
  }

  // Convert wei to ETH for chart display
  const weiToEth = (wei: bigint): number => {
    return Number(formatEther(wei))
  }

  // Calculate cost to buy tokens - use real contract data
  const calculateBuyCost = (tokenAmount: number): bigint => {
    if (!market || tokenAmount <= 0) return BigInt(0)
    
    // Calculate the sum of prices for each token being bought
    const currentTokenNumber = market.tokensSold / BigInt(10 ** 18)
    let totalCost = BigInt(0)
    
    for (let i = 1; i <= tokenAmount; i++) {
      const tokenNumber = currentTokenNumber + BigInt(i)
      totalCost += calculateTokenPrice(tokenNumber)
    }
    
    console.log(`Calculating buy cost for ${tokenAmount} tokens`)
    console.log(`Current token number: ${currentTokenNumber}`)
    console.log(`Total cost: ${formatEther(totalCost)} ETH`)
    
    return totalCost
  }

  // Calculate value from selling tokens - use real contract data
  const calculateSellValue = (tokenAmount: number): bigint => {
    if (!market || tokenAmount <= 0) return BigInt(0)
    
    // Calculate the sum of prices for each token being sold (reverse of buy)
    const currentTokenNumber = market.tokensSold / BigInt(10 ** 18)
    let totalValue = BigInt(0)
    
    for (let i = 0; i < tokenAmount; i++) {
      const tokenNumber = currentTokenNumber - BigInt(i)
      if (tokenNumber > BigInt(0)) {
        totalValue += calculateTokenPrice(tokenNumber)
      }
    }
    
    console.log(`Calculating sell value for ${tokenAmount} tokens`)
    console.log(`Current token number: ${currentTokenNumber}`)
    console.log(`Total value: ${formatEther(totalValue)} ETH`)
    
    return totalValue
  }
  
  // Calculate ETH per token (average value) - use real contract data
  const calculateEthPerToken = (market: Market): bigint => {
    if (market.tokensSold === BigInt(0)) return BigInt(0)
    
    // Convert tokensSold from wei to token numbers for display
    const tokensSoldNumber = market.tokensSold / BigInt(10 ** 18)
    
    // Prevent division by zero
    if (tokensSoldNumber === BigInt(0)) return BigInt(0)
    
    // For linear curve, average price is the middle token price
    const averageTokenNumber = tokensSoldNumber / BigInt(2) + BigInt(1)
    return calculateTokenPrice(averageTokenNumber)
  }

  // Update estimated costs when buy amount changes - use real contract data
  useEffect(() => {
    if (buyCostData && Array.isArray(buyCostData) && buyCostData.length >= 1) {
      setEstimatedBuyCost(buyCostData[0]) // totalCost
    } else {
      const amount = parseInt(buyAmount) || 0
      const cost = calculateBuyCost(amount)
      setEstimatedBuyCost(cost)
    }
  }, [buyAmount, buyCostData, calculateBuyCost])

  // Update estimated value when sell amount changes - use real contract data
  useEffect(() => {
    if (sellRefundData && Array.isArray(sellRefundData) && sellRefundData.length >= 3) {
      setEstimatedSellValue(sellRefundData[2]) // userReceives (after fees)
    } else {
      // Don't set estimated value if contract data is not available
      setEstimatedSellValue(BigInt(0))
    }
  }, [sellAmount, sellRefundData])

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
      args: [BigInt(bondId), BigInt(amount)], // bondId, tokenAmount
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

  // Combined sell function that handles both approval and selling
  const handleSellTokens = () => {
    if (!market || !address) return
    
    const amount = parseInt(sellAmount) || 0
    if (amount <= 0 || amount > Number(userBalance)) return
    
    // Check if we're trying to sell more tokens than have been sold
    if (amount > Number(market.tokensSold)) {
      alert(`Cannot sell ${amount} tokens. Only ${market.tokensSold.toString()} tokens have been sold.`)
      return
    }
    
    // Debug: Check market state before selling
    console.log('=== SELL DEBUG ===')
    console.log('Market state:', {
      tokensSold: market.tokensSold.toString(),
      ethReserve: market.ethReserve.toString(),
      currentPrice: market.currentPrice.toString(),
      userBalance: userBalance.toString()
    })
    console.log(`Selling ${amount} tokens`)
    
    // Use real contract data - this is required for accurate pricing
    if (sellRefundData && Array.isArray(sellRefundData) && sellRefundData.length >= 3) {
      const totalRefund = sellRefundData[0]
      const feeAmount = sellRefundData[1]
      const userReceives = sellRefundData[2]
      
      console.log(`Real contract data:`)
      console.log(`Total refund: ${formatEther(totalRefund)} ETH`)
      console.log(`Fee amount: ${formatEther(feeAmount)} ETH`)
      console.log(`User receives: ${formatEther(userReceives)} ETH`)
      console.log(`ETH Reserve: ${formatEther(market.ethReserve)} ETH`)
      console.log(`Can afford: ${totalRefund <= market.ethReserve}`)
      
      // Check if we have enough ETH in reserve
      if (totalRefund > market.ethReserve) {
        alert(`Cannot sell ${amount} tokens. Not enough ETH in reserve. Total refund: ${formatEther(totalRefund)} ETH, Reserve: ${formatEther(market.ethReserve)} ETH`)
        return
      }
    } else {
      // Contract data not available - show error
      alert(`Cannot sell tokens right now. Please wait for contract data to load and try again.`)
      return
    }
    
    console.log('==================')
    
    setSellStep('selling')
    
    // Step 1: Approve tokens first (ERC20 expects wei, so multiply by 10^18)
    console.log(`Step 1: Approving ${amount} tokens for CurveAMM to spend`)
    writeContract({
      address: market.tokenContract,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACT_ADDRESSES.CURVE_AMM, BigInt(amount * 10**18)],
    }, {
      onSuccess: (data) => {
        console.log('Approval successful, now selling tokens...')
        // Step 2: Sell tokens after approval (add delay to ensure approval is mined)
        setTimeout(() => {
          console.log(`Step 2: Selling ${amount} tokens`)
          console.log(`Approved amount: ${amount * 10**18} wei`)
          console.log(`Selling amount: ${amount} whole tokens`)
          writeContract({
            address: CONTRACT_ADDRESSES.CURVE_AMM,
            abi: CURVE_AMM_ABI,
            functionName: 'sellTokens',
            args: [BigInt(bondId), BigInt(amount)],
          }, {
            onSuccess: () => {
              console.log('Sell completed successfully!')
              setSellStep('idle')
              setSellAmount('')
              // Refresh market data to get updated ethReserve
              refetchMarket()
              // Force a delay to ensure blockchain state is updated
              setTimeout(() => {
                refetchMarket()
              }, 2000)
            },
            onError: (error) => {
              console.error('Error selling tokens:', error)
              setSellStep('idle')
              alert('Failed to sell tokens. Please try again.')
            }
          })
        }, 2000) // Wait 2 seconds for approval to be mined
      },
      onError: (error) => {
        console.error('Error approving tokens:', error)
        setSellStep('idle')
        alert('Failed to approve tokens. Please try again.')
      }
    })
  }

  // Handle defragmentalization (close market and redeem NFTs)
  const handleDefragmentalizeBond = () => {
    if (!market || !address) return
    
    // Check if tokens have been sold
    if (market.tokensSold > BigInt(0)) {
      alert('Cannot close market while tokens are sold. All tokens must be returned to the curve first.')
      return
    }
    
    // Check if user is the creator
    if (market.creator.toLowerCase() !== address.toLowerCase()) {
      alert('Only the bond creator can close the market.')
      return
    }
    
    // Check if market is already inactive
    if (!market.isActive) {
      alert('Market is already closed.')
      return
    }
    
    // Debug: Log market state before closure
    console.log('=== MARKET CLOSURE DEBUG ===')
    console.log('Market state:', {
      bondId: market.bondId,
      bondName: market.bondName,
      isActive: market.isActive,
      tokensSold: market.tokensSold.toString(),
      ethReserve: formatEther(market.ethReserve),
      creator: market.creator,
      userAddress: address
    })
    console.log('=== END MARKET CLOSURE DEBUG ===')
    
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to close the market for "${market.bondName}"?\n\n` +
      `This will:\n` +
      `• Stop all trading on this bond\n` +
      `• Allow you to redeem your NFTs\n` +
      `• Cannot be undone\n\n` +
      `Click OK to proceed.`
    )
    
    if (!confirmed) return
    
    setIsClosingMarket(true)
    
    writeContract({
      address: CONTRACT_ADDRESSES.BOND_FACTORY,
      abi: BOND_FACTORY_ABI,
      functionName: 'defragmentalizeBond',
      args: [BigInt(bondId)],
    }, {
      onSuccess: (data) => {
        console.log('Market closure transaction submitted:', data)
        // Show success message and go back to markets list
        alert(
          `Market closure transaction submitted!\n\n` +
          `Transaction Hash: ${data}\n\n` +
          `Once the transaction is confirmed on the blockchain, you will be able to redeem your NFTs from the bond.`
        )
        onBack()
      },
      onError: (error) => {
        console.error('Error closing market:', error)
        
        // Provide more specific error messages
        let errorMessage = 'Failed to close market. Please try again.'
        
        if (error.message) {
          if (error.message.includes('Cannot defragmentalize bond with sold tokens')) {
            errorMessage = 'Cannot close market while tokens are sold. All tokens must be returned to the curve first.'
          } else if (error.message.includes('Only bond creator can defragmentalize')) {
            errorMessage = 'Only the bond creator can close the market.'
          } else if (error.message.includes('Bond is not fractionalized')) {
            errorMessage = 'Bond is not fractionalized. No market to close.'
          } else if (error.message.includes('Bond already redeemed')) {
            errorMessage = 'Bond has already been redeemed.'
          } else if (error.message.includes('insufficient funds')) {
            errorMessage = 'Insufficient funds to pay for gas fees.'
          } else if (error.message.includes('user rejected')) {
            errorMessage = 'Transaction was cancelled by user.'
          }
        }
        
        alert(errorMessage)
      },
      onSettled: () => {
        setIsClosingMarket(false)
      }
    })
  }

  // Reset sell step when amount changes
  useEffect(() => {
    setSellStep('idle')
  }, [sellAmount])

  // Fetch transaction history
  const fetchTransactionHistory = useCallback(async () => {
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
        const bondTransactions = data.transactions.filter((tx: Transaction) => {
          // Only include buy, sell, and market_created transactions
          const isRelevant = tx.transactionType === 'buy' || tx.transactionType === 'sell' || tx.transactionType === 'market_created'
          console.log(`🔍 Transaction ${tx.hash?.slice(0, 8) || 'unknown'}: type=${tx.transactionType}, bondId=${tx.bondId}, relevant=${isRelevant}`)
          return isRelevant
        })
        
        console.log(`✅ Filtered ${bondTransactions.length} relevant transactions from ${data.transactions.length} total`)
        console.log('📋 Bond transactions:', bondTransactions)
        
        // If we have relevant transactions, update the state and regenerate price history
        if (bondTransactions.length > 0) {
          setTransactionHistory(bondTransactions)
          
          // If we have market data, regenerate price history with the new transactions
          if (market) {
            generatePriceHistory(market)
          }
        } else {
          setTransactionHistory(bondTransactions)
        }
      } else {
        console.log('❌ No transactions field in response')
      }
    } catch (error) {
      console.error('💥 Failed to fetch transaction history:', error)
    } finally {
      setLoadingTransactions(false)
      console.log('🏁 Transaction history fetch completed')
    }
  }, [bondId, market]) // Add dependencies

  // Load transaction history when component mounts
  useEffect(() => {
    console.log('🚀 Component mounted, fetching transaction history for bondId:', bondId)
    fetchTransactionHistory()
  }, [bondId]) // Remove fetchTransactionHistory from dependencies

  // Format helpers
  const formatEthPrice = (wei: bigint) => {
    const eth = formatEther(wei)
    const num = parseFloat(eth)
    if (num < 0.00001) return '< 0.00001'
    return num.toFixed(5)
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

  // Chart data
  // Determine chart time range based on market activity events
  const getTimeAxisRange = () => {
    // If no transaction history, use default time range
    if (transactionHistory.length === 0) {
      const now = Math.floor(Date.now() / 1000);
      return {
        start: now - 86400, // 24 hours ago
        end: now
      };
    }

    // Sort transactions by timestamp (oldest first)
    const sortedTxs = [...transactionHistory]
      .filter(tx => tx.timestamp)
      .sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));

    if (sortedTxs.length === 0) return { start: 0, end: 0 };

    // Get first and last event timestamps
    const firstEvent = parseInt(sortedTxs[0].timestamp);
    const lastEvent = parseInt(sortedTxs[sortedTxs.length - 1].timestamp);
    
    // Use market creation time if available
    const marketCreationEvent = sortedTxs.find(tx => tx.transactionType === 'market_created');
    const startTime = marketCreationEvent ? parseInt(marketCreationEvent.timestamp) : firstEvent;
    
    // Add more padding to the time range (4 hours before first event, 4 hours after last event)
    const paddedStart = startTime - 14400;
    const paddedEnd = lastEvent + 14400;
    
    console.log(`Chart time range: ${new Date(paddedStart * 1000).toLocaleString()} to ${new Date(paddedEnd * 1000).toLocaleString()}`);
    
    return {
      start: paddedStart,
      end: paddedEnd
    };
  };

  // Get time axis range
  const timeRange = getTimeAxisRange();
  
  // Ensure minimum bond price values for better visibility
  const ensureMinimumValue = (value: number, minValue: number = 0.00001) => {
    return value < minValue ? minValue : value;
  };

  const chartData = {
    // For time-based x-axis, we need to format data differently
    datasets: [
      {
        label: 'Bond Price (ETH)',
        data: priceHistory.map(p => ({
          x: p.timestamp ? p.timestamp * 1000 : Date.now(), // Convert to milliseconds for Chart.js
          y: ensureMinimumValue(p.price, 0.00001) // Use price directly (already in ETH)
        })),
        borderColor: 'rgb(59, 130, 246)', // blue
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        pointRadius: (context: { dataIndex: number }) => {
          const point = priceHistory[context.dataIndex];
          if (!point || !point.type) return 4; // Increased default point size
          if (point.type === 'buy') return 10; // Larger points for buy transactions
          if (point.type === 'sell') return 10; // Larger points for sell transactions
          if (point.type === 'market_created') return 8; // Medium size for market creation
          return 4; // Default size for other points
        },
        pointBackgroundColor: (context: { dataIndex: number }) => {
          const point = priceHistory[context.dataIndex];
          if (!point || !point.type) return 'rgba(59, 130, 246, 0.5)';
          
          if (point.type === 'buy') return 'rgba(34, 197, 94, 0.9)'; // green
          if (point.type === 'sell') return 'rgba(239, 68, 68, 0.9)'; // red
          if (point.type === 'market_created') return 'rgba(124, 58, 237, 0.9)'; // purple
          return 'rgba(59, 130, 246, 0.5)'; // blue
        },
        pointBorderColor: (context: { dataIndex: number }) => {
          const point = priceHistory[context.dataIndex];
          if (!point || !point.type) return 'rgba(59, 130, 246, 1)';
          
          if (point.type === 'buy') return 'rgba(34, 197, 94, 1)'; // green
          if (point.type === 'sell') return 'rgba(239, 68, 68, 1)'; // red
          if (point.type === 'market_created') return 'rgba(124, 58, 237, 1)'; // purple
          return 'rgba(59, 130, 246, 1)'; // blue
        },
        pointBorderWidth: 2,
        pointHoverRadius: 10,
        pointHoverBorderWidth: 3,
        pointHitRadius: 15, // Easier to hover/click on points
        tension: 0.2, // Slightly smoother curve
        fill: 'origin',
        stepped: false,
        showLine: true, // Ensure line is visible
        spanGaps: true, // Connect points even if there are gaps
      }
    ]
  }

  // Create annotations for transaction events
  const createEventAnnotations = () => {
    const annotations: Record<string, any> = {};
    
    // Add annotations for each transaction point
    priceHistory.forEach((point, index) => {
      if (point.type === 'buy' || point.type === 'sell' || point.type === 'market_created') {
        const color = point.type === 'buy' 
          ? 'rgba(34, 197, 94, 1)' 
          : point.type === 'sell' 
            ? 'rgba(239, 68, 68, 1)' 
            : 'rgba(124, 58, 237, 1)';
        
        // Use bond price for y-value with minimum value
        const yValue = ensureMinimumValue(point.price, 0.00001);
        
        annotations[`point-${index}`] = {
          type: 'point',
          xValue: point.timestamp ? point.timestamp * 1000 : Date.now(),
          yValue: yValue,
          backgroundColor: color,
          borderColor: 'white',
          borderWidth: 2,
          radius: point.type === 'market_created' ? 8 : 10,
          z: 10
        };
      }
    });
    
    return annotations;
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Time'
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          autoSkip: true,
          maxTicksLimit: 8
        },
        // Set time axis min/max based on market activity events
        min: timeRange.start * 1000, // Convert to milliseconds for Chart.js
        max: timeRange.end * 1000,
        type: 'time',
        time: {
          unit: 'hour',
          displayFormats: {
            minute: 'MMM d, HH:mm',
            hour: 'MMM d, HH:mm',
            day: 'MMM d, yyyy'
          },
          tooltipFormat: 'MMM d, yyyy HH:mm'
        }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Bond Price (ETH)'
        },
        ticks: {
          callback: function(value) {
            return Number(value).toFixed(5) + ' ETH'
          }
        },
        // Set a reasonable max value based on bond prices (in ETH)
        suggestedMax: Math.max(
          ...priceHistory
            .map(p => p.price)
        ) * 1.2 || 0.001
      }
    },
    plugins: {
      legend: {
        display: false,
      },
      annotation: {
        annotations: createEventAnnotations()
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
          title: function(tooltipItems) {
            // With time-based axis, the x value is already a timestamp in milliseconds
            const timestamp = tooltipItems[0].parsed.x;
            const date = new Date(timestamp);
            // Format: Month day, year HH:MM
            return date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          },
          label: function(context: { parsed: { y: number, x: number }, dataIndex: number }) {
            const point = priceHistory[context.dataIndex];
            let label = `Bond Price: ${context.parsed.y.toFixed(5)} ETH`;
            
            // Add transaction info if available
            if (point && point.type) {
              if (point.type === 'market_created') {
                label = `Market Created\nBond Price: ${context.parsed.y.toFixed(5)} ETH`;
              } else if (point.type === 'buy') {
                label = `Buy Transaction\nBond Price: ${context.parsed.y.toFixed(5)} ETH`;
                
                if (point.hash) {
                  label += `\nTx: ${point.hash.slice(0, 6)}...${point.hash.slice(-4)}`;
                }
              } else if (point.type === 'sell') {
                label = `Sell Transaction\nBond Price: ${context.parsed.y.toFixed(5)} ETH`;
                
                if (point.hash) {
                  label += `\nTx: ${point.hash.slice(0, 6)}...${point.hash.slice(-4)}`;
                }
              }
            }
            
            return label;
          }
        }
      }
    },
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
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => refetchMarket()} 
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          
          {/* Close Market button - only show for market creator when market is active and no tokens sold */}
          {market && market.isActive && address && market.creator.toLowerCase() === address.toLowerCase() && (
            <div className="flex flex-col items-end space-y-2">
              <button 
                onClick={handleDefragmentalizeBond}
                disabled={isClosingMarket || market.tokensSold > BigInt(0)}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative group"
                title={market.tokensSold > BigInt(0) ? "Cannot close market with sold tokens" : "Close market and redeem NFTs"}
              >
                {isClosingMarket ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Power className="h-4 w-4" />
                )}
                {isClosingMarket ? 'Closing...' : 'Close Market'}
                
                {/* Hover tooltip for when tokens are sold */}
                {market.tokensSold > BigInt(0) && (
                  <div className="absolute bottom-full right-0 mb-2 px-3 py-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                    Market cannot be closed while tokens are sold
                  </div>
                )}
              </button>
            </div>
          )}
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
                <span>{formatNumber(market.totalSupply / BigInt(10 ** 18))}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Supply in Curve:</span>
                <span>{formatNumber((market.tokensForSale - market.tokensSold) / BigInt(10 ** 18))}</span>
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
                <span>Buy: <span className="text-green-600 font-medium">
                  {buyCostData && Array.isArray(buyCostData) && buyCostData.length >= 1 && parseInt(buyAmount) > 0 
                    ? formatEthPrice(buyCostData[0] / BigInt(Math.max(1, parseInt(buyAmount)))) // totalCost / amount (prevent div by 0)
                    : defaultBuyCostData && Array.isArray(defaultBuyCostData) && defaultBuyCostData.length >= 1
                      ? formatEthPrice(defaultBuyCostData[0]) // totalCost for 1 token
                      : formatEthPrice(market.currentPrice)
                  } ETH
                </span></span>
              </div>
              <div className="flex items-center">
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                <span>Sell: <span className="text-red-600 font-medium">
                  {sellRefundData && Array.isArray(sellRefundData) && sellRefundData.length >= 3 && parseInt(sellAmount) > 0 
                    ? formatEthPrice(sellRefundData[2] / BigInt(Math.max(1, parseInt(sellAmount)))) // userReceives / amount (prevent div by 0)
                    : defaultSellRefundData && Array.isArray(defaultSellRefundData) && defaultSellRefundData.length >= 3
                      ? formatEthPrice(defaultSellRefundData[2]) // userReceives for 1 token
                      : market.tokensSold > BigInt(0) 
                        ? formatEthPrice(market.ethReserve / market.tokensSold) 
                        : '0.00000'
                  } ETH
                </span></span>
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
                <div className="font-medium">{formatNumber(userBalance / BigInt(10 ** 18))}</div>
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
                      <button
                        onClick={handleSellTokens}
                        className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        disabled={!market.isActive || parseInt(sellAmount) <= 0 || parseInt(sellAmount) > Number(userBalance) || !address || sellStep === 'selling' || !sellRefundData}
                      >
                        {sellStep === 'selling' ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-1 inline" />
                            Selling...
                          </>
                        ) : (
                          'Sell'
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>You will receive:</span>
                      <span className="font-medium">
                        {isSellRefundLoading 
                          ? 'Loading...'
                          : sellRefundError
                            ? 'Error: ' + sellRefundError.message
                            : sellRefundData && Array.isArray(sellRefundData) && sellRefundData.length >= 3 
                              ? formatEthPrice(estimatedSellValue) + ' ETH'
                              : 'No data'
                        }
                      </span>
                    </div>
                  </div>
                  

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
                    const totalSupply = Number(market.totalSupply / BigInt(10 ** 18));
                    const holders: TokenHolder[] = [];
                    
                    // Add current user if they have balance
                    if (address && userBalance > BigInt(0)) {
                      const userBalanceNumber = Number(userBalance / BigInt(10 ** 18));
                      holders.push({
                        address: address,
                        balance: userBalanceNumber.toString(),
                        percentage: (userBalanceNumber / totalSupply * 100).toFixed(1)
                      });
                    }
                    
                    // Add contract as holder of remaining supply
                    const contractBalance = totalSupply - Number(userBalance / BigInt(10 ** 18));
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

        {/* Center and Right columns - Chart and Market Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Price History Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Price History</h3>
            <div className="h-80">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        
          {/* Market Activity */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Market Activity</h3>
              <button
                onClick={fetchTransactionHistory}
                disabled={loadingTransactions}
                className="flex items-center gap-2 px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loadingTransactions ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {loadingTransactions ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            <div className="overflow-auto max-h-[400px]">
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
                <Inventory bondId={bondId} />
              </div>
          </div>
        </div>
      )}
    </div>
  )
} 