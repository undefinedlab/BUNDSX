const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import NFT functions
const nftFunctions = require('./nfts');

const app = express();
const PORT = process.env.PORT || 3003;
// 1inch API configuration
const ONECHIN_API_KEY = process.env.ONECHIN_API_KEY || 'wrAAsbZAQBZYFAekiECgqEvGneNO569Z';
const ONECHIN_BASE_URL = 'https://api.1inch.dev';
// Middleware
app.use(cors());
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to BUNDSX Backend API' });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get NFTs by address
app.get('/api/nft/tokens/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { chainId, limit = 50, offset = 0 } = req.query;
    
    const data = await nftFunctions.getNFTsByAddress(address, chainId, limit, offset);
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching NFTs:', error);
    res.status(500).json({ error: 'Failed to fetch NFTs', details: error.message });
  }
});

// Get best offer for a specific NFT
app.get('/api/opensea/best-offer/:slug/:tokenId', async (req, res) => {
  try {
    const { slug, tokenId } = req.params;
    console.log('Best offer request:', { slug, tokenId });
    
    const { maxOffer, maxOfferBidder } = await nftFunctions.getBestOfferForNFT(slug, tokenId);
    
    res.json({ maxOffer, maxOfferBidder });
  } catch (error) {
    console.error('OpenSea Best Offer fetch error:', error);
    res.status(500).json({ maxOffer: null, error: 'Failed to fetch best offer', details: error.message });
  }
});

// Get collection information by contract address
app.get('/api/opensea/collection/:contractAddress', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    
    const data = await nftFunctions.getCollectionInfo(contractAddress);
    
    res.json(data);
  } catch (error) {
    console.error('OpenSea Collection fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch collection', details: error.message });
  }
});

// Get best offers for multiple NFTs
app.post('/api/opensea/best-offers', async (req, res) => {
  try {
    const { nfts } = req.body; // Array of { contractAddress, tokenId, slug }
    
    if (!Array.isArray(nfts)) {
      return res.status(400).json({ error: 'nfts must be an array' });
    }
    
    const results = await nftFunctions.getBestOffersForMultipleNFTs(nfts);
    
    res.json({ results });
  } catch (error) {
    console.error('OpenSea Best Offers batch fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch best offers', details: error.message });
  }
});


// Get transaction history for a contract address using 1inch History API
app.get('/api/transactions/history/:contractAddress', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    const { 
      chainId = 8453, // Default to Base chain
      limit = 100, 
      offset = 0,
      fromTimestamp,
      toTimestamp 
    } = req.query;
    
    console.log(`[TRANSACTIONS] Fetching transaction history for contract: ${contractAddress} on chain: ${chainId}`);
    
    // Direct axios call to 1inch API following their docs
    const url = `${ONECHIN_BASE_URL}/history/v2.0/history/${contractAddress}/events`;
    
    console.log(`[TRANSACTIONS] Using 1inch API URL: ${url}`);
    
    const config = {
      headers: {
        'Authorization': `Bearer ${ONECHIN_API_KEY}`,
        'accept': 'application/json',
        'content-type': 'application/json'
      },
      params: {
        limit: parseInt(limit),
        chainId: chainId.toString(),
        offset: parseInt(offset)
      },
      paramsSerializer: {
        indexes: null,
      },
    };
    
    // Add timestamp filters if provided
    if (fromTimestamp) {
      config.params.fromTimestamp = parseInt(fromTimestamp);
    }
    if (toTimestamp) {
      config.params.toTimestamp = parseInt(toTimestamp);
    }
    
    console.log(`[TRANSACTIONS] Making API call to: ${url}`);
    console.log(`[TRANSACTIONS] With params:`, JSON.stringify(config.params));
    
    const response = await axios.get(url, config);
    const data = response.data;
    
    console.log(`[TRANSACTIONS] API response status: ${response.status}`);
    console.log(`[TRANSACTIONS] Data keys:`, Object.keys(data));
    
    // Process transactions to identify bond-related activities
    const processedTransactions = [];
    const items = data.items || [];
    
    console.log(`[TRANSACTIONS] Processing ${items.length} items`);
    console.log(`[TRANSACTIONS] First item sample:`, items.length > 0 ? JSON.stringify(items[0]).substring(0, 500) : 'No items');
    
    for (const item of items) {
      // 1inch API returns a different format - extract transaction details
      const details = item.details || {};
      const txHash = details.txHash;
      const input = details.input || '';
      
      // Skip if no transaction hash
      if (!txHash) {
        console.log(`[TRANSACTIONS] Skipping item without txHash`);
        continue;
      }
      
      // Extract methodId from input if available
      const methodId = input ? input.slice(0, 10) : '';
      let transactionType = 'unknown';
      let bondId = null;
      let tokenAmount = null;
      let ethAmount = null;
      
      // Try to determine transaction type from tokenActions
      if (details.tokenActions && details.tokenActions.length > 0) {
        const ethTransfers = details.tokenActions.filter(action => 
          action.address === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' && 
          action.standard === 'Native'
        );
        
        if (ethTransfers.length > 0) {
          // Check for ETH transfers to/from our contract
          const incomingEth = ethTransfers.find(action => 
            action.toAddress?.toLowerCase() === contractAddress.toLowerCase() && 
            action.direction === 'In'
          );
          
          const outgoingEth = ethTransfers.find(action => 
            action.fromAddress?.toLowerCase() === contractAddress.toLowerCase() && 
            action.direction === 'Out'
          );
          
          if (incomingEth) {
            transactionType = 'buy';
            ethAmount = (parseFloat(incomingEth.amount) / 1e18).toFixed(6);
          } else if (outgoingEth) {
            transactionType = 'sell';
            ethAmount = (parseFloat(outgoingEth.amount) / 1e18).toFixed(6);
          }
        }
      }
      
      // Check for market creation events based on method signature or event name
      if (methodId === '0x6c7d13e2' || methodId === '0x7bf0c215' || 
          (details.eventName && details.eventName.includes('MarketCreated'))) {
        transactionType = 'market_created';
        console.log(`[TRANSACTIONS] Identified market creation event: ${txHash}`);
      }
      
      // Try to extract bondId from input data if we have it
      if (input && input.length >= 74) {
        try {
          // bondId is typically the first parameter (32 bytes after method ID)
          const bondIdHex = input.slice(10, 74);
          bondId = parseInt(bondIdHex, 16);
          console.log(`[TRANSACTIONS] Extracted bondId: ${bondId} from transaction input`);
        } catch (e) {
          console.log(`[TRANSACTIONS] Failed to extract bondId from input:`, e);
        }
      }
      
      // If we couldn't determine bondId from input, try to use a default
      if (bondId === null && req.query.bondId) {
        bondId = parseInt(req.query.bondId);
        console.log(`[TRANSACTIONS] Using query bondId: ${bondId}`);
      }
      
      // Create processed transaction
      processedTransactions.push({
        hash: txHash,
        blockNumber: details.blockNumber,
        timestamp: Math.floor(item.timeMs / 1000),
        from: details.fromAddress,
        to: details.toAddress,
        value: ethAmount ? (parseFloat(ethAmount) * 1e18).toString() : '0',
        ethAmount: ethAmount,
        transactionType: transactionType,
        bondId: bondId,
        tokenAmount: tokenAmount,
        status: details.status === 'completed' ? '1' : '0',
        methodId: methodId,
        rawDetails: details
      });
    }
    
    // Sort by timestamp (newest first)
    processedTransactions.sort((a, b) => {
      const timestampA = parseInt(a.timestamp || 0);
      const timestampB = parseInt(b.timestamp || 0);
      return timestampB - timestampA;
    });
    
    // Filter transactions by bondId if we have that parameter
    const filteredByBondId = req.query.bondId 
      ? processedTransactions.filter(tx => tx.bondId === parseInt(req.query.bondId))
      : processedTransactions;
    
    console.log(`[TRANSACTIONS] Returning ${filteredByBondId.length} processed transactions`);
    
    res.json({
      transactions: filteredByBondId,
      processed: true,
      contractAddress: contractAddress,
      chainId: parseInt(chainId),
      totalCount: filteredByBondId.length,
      requestParams: config.params
    });
    
  } catch (error) {
    console.error('[TRANSACTIONS] Error fetching transaction history:', error.message);
    if (error.response) {
      console.error('[TRANSACTIONS] API response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    res.status(500).json({ 
      error: 'Failed to fetch transaction history', 
      details: error.message 
    });
  }
});

// Get specific transaction details for better parsing
app.get('/api/transactions/details/:txHash', async (req, res) => {
  try {
    const { txHash } = req.params;
    const { chainId = 1 } = req.query;
    
    console.log(`Fetching transaction details for: ${txHash} on chain: ${chainId}`);
    
    const data = await assetFuncs.makeOptimizedApiCall('/history/v2.0/transaction', {
      chainId: parseInt(chainId),
      hash: txHash
    }, req);
    
    res.json(data);
    
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transaction details', 
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`NFT API: http://localhost:${PORT}/api/nft/tokens/:address`);
}); 