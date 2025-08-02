const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import NFT functions
const nftFunctions = require('./nfts');

const app = express();
const PORT = process.env.PORT || 3003;

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