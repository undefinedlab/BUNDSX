# BUNDSX Backend Server

A comprehensive backend server for the BUNDSX NFT fractionalization platform, providing API endpoints for NFT data retrieval, smart contract interactions, and transaction history.

## 🏗️ Architecture Overview

The backend consists of:
- **Express.js API Server** - RESTful endpoints for frontend integration
- **Smart Contracts** - Solidity contracts for bond creation and trading
- **NFT Data Services** - Integration with 1inch and OpenSea APIs
- **Transaction History** - Blockchain transaction monitoring and parsing

## 📁 Project Structure

```
back/
├── contracts/           # Smart contracts
│   ├── bn.sol          # BondNFT - Main NFT contract
│   ├── bnfc.sol        # BondFactory - Bond creation factory
│   ├── bnt.sol         # BondToken - ERC20 tokens for bonds
│   └── crv.sol         # CurveAMM - Automated market maker
├── src/
│   └── components/     # Additional components
├── nfts.js             # NFT data fetching utilities
├── server.js           # Main Express server
├── package.json        # Dependencies
└── README.md           # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Environment variables configured

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Start development server
npm run dev

# Start production server
npm start
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3003

# API Keys
ONECHIN_API_KEY=your_1inch_api_key_here
OPENSEA_API_KEY=your_opensea_api_key_here

# Optional: Override API URLs
ONECHIN_BASE_URL=https://api.1inch.dev
```

## 🔧 Smart Contracts

### BondNFT (`bn.sol`)
- **Purpose**: Main NFT contract representing bond ownership
- **Features**:
  - Fractionalization support
  - Vault management for trading fees
  - Token redemption mechanisms
  - Emergency withdrawal functions

### BondFactory (`bnfc.sol`)
- **Purpose**: Factory contract for creating bonds
- **Features**:
  - NFT locking and bond creation
  - Bond metadata management
  - User bond tracking
  - Defragmentalization support

### BondToken (`bnt.sol`)
- **Purpose**: ERC20 tokens for fractionalized bonds
- **Features**:
  - Individual tokens per bond
  - Minting/burning controls
  - Factory pattern for deployment

### CurveAMM (`crv.sol`)
- **Purpose**: Automated market maker for bond token trading
- **Features**:
  - Exponential bonding curve
  - Buy/sell functionality
  - Fee collection and distribution
  - Market management

## 🌐 API Endpoints

### Base URL
```
http://localhost:3003
```

### Health Check
```http
GET /health
```
Returns server status and timestamp.

### NFT Endpoints

#### Get NFTs by Address
```http
GET /api/nft/tokens/:address?chainId=1&limit=50&offset=0
```

**Parameters:**
- `address` (path): Wallet address
- `chainId` (query): Blockchain network ID (default: 1 for Ethereum)
- `limit` (query): Number of NFTs to return (default: 50)
- `offset` (query): Pagination offset (default: 0)

**Response:**
```json
{
  "assets": [
    {
      "id": "1",
      "name": "Bored Ape #1234",
      "image_url": "https://...",
      "collection_name": "Bored Ape Yacht Club",
      "token_id": "1234",
      "asset_contract": {
        "address": "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d",
        "name": "Bored Ape Yacht Club"
      },
      "max_offer": "12.5",
      "max_offer_bidder": "0xabc..."
    }
  ]
}
```

#### Get Best Offer for NFT
```http
GET /api/opensea/best-offer/:slug/:tokenId
```

**Parameters:**
- `slug` (path): Collection slug
- `tokenId` (path): NFT token ID

**Response:**
```json
{
  "maxOffer": "12.5",
  "maxOfferBidder": "0xabc..."
}
```

#### Get Collection Information
```http
GET /api/opensea/collection/:contractAddress
```

**Parameters:**
- `contractAddress` (path): NFT contract address

#### Get Best Offers for Multiple NFTs
```http
POST /api/opensea/best-offers
```

**Body:**
```json
{
  "nfts": [
    {
      "contractAddress": "0x...",
      "tokenId": "1234",
      "slug": "boredapeyachtclub"
    }
  ]
}
```

### Transaction History

#### Get Transaction History
```http
GET /api/transactions/history/:contractAddress?chainId=8453&limit=100&offset=0&bondId=1
```

**Parameters:**
- `contractAddress` (path): Contract address to monitor
- `chainId` (query): Blockchain network ID (default: 8453 for Base)
- `limit` (query): Number of transactions (default: 100)
- `offset` (query): Pagination offset (default: 0)
- `bondId` (query): Filter by specific bond ID
- `fromTimestamp` (query): Start timestamp filter
- `toTimestamp` (query): End timestamp filter

**Response:**
```json
{
  "transactions": [
    {
      "hash": "0x...",
      "blockNumber": 123456,
      "timestamp": 1640995200,
      "from": "0x...",
      "to": "0x...",
      "value": "1000000000000000000",
      "ethAmount": "1.0",
      "transactionType": "buy",
      "bondId": 1,
      "tokenAmount": "100",
      "status": "1",
      "methodId": "0x6c7d13e2"
    }
  ],
  "processed": true,
  "contractAddress": "0x...",
  "chainId": 8453,
  "totalCount": 50
}
```

#### Get Transaction Details
```http
GET /api/transactions/details/:txHash?chainId=1
```

**Parameters:**
- `txHash` (path): Transaction hash
- `chainId` (query): Blockchain network ID (default: 1)

## 🔌 External API Integrations

### 1inch API
- **Purpose**: NFT data retrieval
- **Endpoints Used**:
  - `/nft/v2/byaddress` - Get NFTs by wallet address
  - `/history/v2.0/history/{address}/events` - Get transaction history

### OpenSea API
- **Purpose**: NFT metadata and offers
- **Endpoints Used**:
  - `/api/v2/chain/ethereum/account/{address}/nfts` - Get user NFTs
  - `/api/v2/offers/collection/{slug}/nfts/{tokenId}/best` - Get best offers
  - `/api/v2/collections/ethereum/{contractAddress}` - Get collection info

## 🛠️ Development

### Running in Development Mode
```bash
npm run dev
```
Uses nodemon for automatic restarts on file changes.

### Testing
```bash
npm test
```

### Code Structure

#### `server.js`
Main Express server with:
- CORS configuration
- Route definitions
- Error handling middleware
- Health check endpoints

#### `nfts.js`
NFT data utilities:
- `getNFTsByAddress()` - Fetch NFTs from 1inch API
- `getOpenSeaNFTs()` - Fetch NFTs from OpenSea
- `getBestOfferForNFT()` - Get best offers for specific NFTs
- `enhanceNFTsWithOpenSeaData()` - Combine data from multiple sources

## 🔒 Security Features

### Smart Contract Security
- Reentrancy protection
- Access control modifiers
- Emergency pause functions
- Circuit breakers for large transactions

### API Security
- Input validation
- Rate limiting (implemented in OpenSea calls)
- Error handling with fallbacks
- CORS configuration

## 📊 Performance Optimizations

### NFT Data Fetching
- Parallel API calls where possible
- Caching of collection metadata
- Batch processing for multiple NFTs
- Fallback to mock data on API failures

### Transaction Processing
- Efficient parsing of blockchain data
- Filtering by bond ID for relevant transactions
- Pagination support for large datasets

## 🚨 Error Handling

The server includes comprehensive error handling:
- API timeout management
- Graceful degradation with mock data
- Detailed error logging
- User-friendly error responses

## 📈 Monitoring

### Health Checks
- Server status endpoint
- API connectivity monitoring
- Response time tracking

### Logging
- Request/response logging
- Error tracking
- Performance metrics

## 🔄 Deployment

### Production Setup
1. Set environment variables
2. Install dependencies: `npm install --production`
3. Start server: `npm start`

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3003
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the documentation
2. Review existing issues
3. Create a new issue with detailed information

---

**Note**: This backend server is designed to work with the BUNDSX frontend application and requires proper configuration of API keys and smart contract addresses for full functionality. 