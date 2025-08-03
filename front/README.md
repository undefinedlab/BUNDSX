# BUNDSX Frontend Application

A modern Next.js frontend application for the BUNDSX NFT fractionalization platform, providing an intuitive interface for creating bonds, trading fractionalized tokens, and managing NFT portfolios.

## 🏗️ Architecture Overview

The frontend is built with:
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Wagmi + Viem** - Ethereum wallet integration
- **RainbowKit** - Wallet connection UI
- **React Query** - Server state management
- **Zustand** - Client state management

## 📁 Project Structure

```
front/
├── public/                 # Static assets
│   ├── assets/            # Images and animations
│   └── *.svg              # Icon assets
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── globals.css    # Global styles
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Home page
│   ├── components/        # React components
│   │   ├── assets/        # Asset components
│   │   ├── modals/        # Modal components
│   │   ├── pages/         # Page components
│   │   ├── tabs/          # Tab components
│   │   ├── connect-wallet.tsx
│   │   └── providers.tsx
│   ├── hooks/             # Custom React hooks
│   │   ├── useBondCreation.ts
│   │   ├── useBondPump.ts
│   │   ├── useBondRedemption.ts
│   │   ├── useBonds.ts
│   │   ├── useContractInitialization.ts
│   │   └── useNFTs.ts
│   └── lib/               # Utility libraries
│       ├── contracts.ts   # Contract configurations
│       ├── types.ts       # TypeScript types
│       └── wagmi.ts       # Wagmi configuration
├── package.json           # Dependencies
├── next.config.ts         # Next.js configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── tsconfig.json          # TypeScript configuration
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm, yarn, or pnpm
- Backend server running (see backend README)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3003

# Blockchain Configuration
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_RPC_URL=https://mainnet.base.org

# Contract Addresses (Base Chain)
NEXT_PUBLIC_BOND_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_CURVE_AMM_ADDRESS=0x...
NEXT_PUBLIC_BOND_TOKEN_FACTORY_ADDRESS=0x...

# Optional: Analytics
NEXT_PUBLIC_ANALYTICS_ID=your_analytics_id
```

## 🎨 UI Components

### Core Components

#### ConnectWallet
- **Purpose**: Wallet connection interface using RainbowKit
- **Features**: Multi-wallet support, network switching, account display

#### Providers
- **Purpose**: App-wide context providers
- **Includes**: Wagmi, React Query, theme providers

### Page Components

#### Home (`pages/home.tsx`)
- **Purpose**: Landing page with platform overview
- **Features**: Hero section, statistics, quick actions

#### Assets (`pages/assets.tsx`)
- **Purpose**: NFT portfolio management
- **Features**:
  - NFT grid display with selection
  - Collection filtering
  - Best offer display
  - Bond creation workflow

#### Create Bond (`pages/create-bond.tsx`)
- **Purpose**: Bond creation interface
- **Features**:
  - Selected NFT preview
  - Bond metadata input
  - Gas estimation
  - Transaction confirmation

#### Markets (`pages/markets.tsx`)
- **Purpose**: Bond token trading interface
- **Features**:
  - Market list with real-time data
  - Price charts and statistics
  - Buy/sell functionality
  - Market management tools

#### Market Details (`pages/market-details.tsx`)
- **Purpose**: Detailed market view
- **Features**:
  - Price curve visualization
  - Transaction history
  - Token holder analysis
  - Trading interface

#### Inventory (`pages/inventory.tsx`)
- **Purpose**: Bond asset management
- **Features**:
  - NFT metadata display
  - Asset redemption
  - Bond status tracking

### Modal Components

#### Create Bond Modal (`modals/create-bond-modal.tsx`)
- **Purpose**: Bond creation workflow
- **Features**: Form validation, transaction handling, success feedback

#### Pump Bond Modal (`modals/pump-bond-modal.tsx`)
- **Purpose**: Bond fractionalization interface
- **Features**: Supply configuration, market creation, fee calculation

### Tab Components

#### NFTs Tab (`tabs/nfts-tab.tsx`)
- **Purpose**: NFT selection interface
- **Features**: Grid view, filtering, bulk selection

#### Bonds Tab (`tabs/bonds-tab.tsx`)
- **Purpose**: User bond management
- **Features**: Bond list, redemption, pump actions

## 🔧 Custom Hooks

### useNFTs
- **Purpose**: NFT data management
- **Features**:
  - Fetch NFTs from backend API
  - Caching and state management
  - Error handling and retry logic
  - Real-time updates

### useBonds
- **Purpose**: Bond data management
- **Features**:
  - Fetch user bonds from smart contracts
  - Bond metadata retrieval
  - Status tracking

### useBondCreation
- **Purpose**: Bond creation workflow
- **Features**:
  - Smart contract interaction
  - Transaction handling
  - Gas estimation
  - Success/failure handling

### useBondPump
- **Purpose**: Bond fractionalization
- **Features**:
  - Market creation
  - Token supply management
  - Curve AMM integration

### useBondRedemption
- **Purpose**: Bond redemption workflow
- **Features**:
  - NFT unlocking
  - Token burning
  - Asset recovery

### useContractInitialization
- **Purpose**: Smart contract setup
- **Features**:
  - Contract address validation
  - ABI loading
  - Network configuration

## 🌐 API Integration

### Backend Communication
The frontend communicates with the backend server for:
- NFT data retrieval
- Transaction history
- Market statistics
- Collection metadata

### Smart Contract Interaction
Direct blockchain interaction for:
- Bond creation and management
- Token trading
- Asset redemption
- Market operations

## 🎯 Key Features

### NFT Management
- **Portfolio View**: Display all user NFTs with metadata
- **Selection Interface**: Multi-select NFTs for bond creation
- **Offer Integration**: Show best offers from OpenSea
- **Collection Filtering**: Filter by collection and traits

### Bond Creation
- **Multi-NFT Bonds**: Combine multiple NFTs into single bonds
- **Metadata Management**: Custom bond names and descriptions
- **Gas Optimization**: Efficient transaction batching
- **Status Tracking**: Real-time creation progress

### Trading Interface
- **Market Discovery**: Browse all active bond markets
- **Price Charts**: Visualize bonding curves
- **Buy/Sell Orders**: Execute trades with slippage protection
- **Portfolio Tracking**: Monitor token holdings

### Advanced Features
- **Defragmentalization**: Convert fractionalized bonds back to whole NFTs
- **Emergency Functions**: Admin controls for market management
- **Analytics**: Trading volume and market statistics
- **Mobile Responsive**: Optimized for all device sizes

## 🎨 Design System

### Styling
- **Tailwind CSS**: Utility-first styling approach
- **Custom Components**: Reusable UI components
- **Responsive Design**: Mobile-first approach
- **Dark Mode**: Theme support (planned)

### Icons and Assets
- **Lucide React**: Modern icon library
- **Lottie Animations**: Smooth loading animations
- **Custom SVGs**: Platform-specific icons

## 🔒 Security Features

### Wallet Integration
- **Multi-Wallet Support**: MetaMask, WalletConnect, Coinbase Wallet
- **Network Validation**: Automatic network switching
- **Transaction Signing**: Secure transaction approval

### Smart Contract Security
- **Input Validation**: Client-side parameter validation
- **Gas Estimation**: Accurate transaction cost calculation
- **Error Handling**: Graceful failure recovery

## 📊 Performance Optimizations

### Data Fetching
- **React Query**: Intelligent caching and background updates
- **Pagination**: Efficient data loading for large datasets
- **Optimistic Updates**: Immediate UI feedback

### Bundle Optimization
- **Code Splitting**: Automatic route-based splitting
- **Tree Shaking**: Unused code elimination
- **Image Optimization**: Next.js built-in optimization

## 🧪 Development

### Development Commands
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Type checking
npx tsc --noEmit
```

### Code Quality
- **ESLint**: Code linting with Next.js rules
- **TypeScript**: Static type checking
- **Prettier**: Code formatting (configured)

### Testing Strategy
- **Component Testing**: React Testing Library
- **Integration Testing**: API and contract interactions
- **E2E Testing**: Playwright (planned)

## 📱 Browser Support

- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **Mobile Browsers**: iOS Safari, Chrome Mobile
- **Wallet Support**: MetaMask, WalletConnect compatible

## 🚀 Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

### Other Platforms
- **Netlify**: Static site deployment
- **AWS Amplify**: Full-stack deployment
- **Docker**: Containerized deployment

### Environment Setup
1. Configure environment variables
2. Set up custom domain (optional)
3. Configure analytics (optional)
4. Set up monitoring (optional)

## 🔧 Configuration

### Next.js Configuration
```typescript
// next.config.ts
const nextConfig = {
  // Enable experimental features
  experimental: {
    // Add any experimental features
  },
  
  // Image optimization
  images: {
    domains: ['api.opensea.io', 'via.placeholder.com'],
  },
  
  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};
```

### Tailwind Configuration
```javascript
// tailwind.config.js
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Custom color palette
      },
    },
  },
  plugins: [],
};
```

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests if applicable
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Standards
- Follow TypeScript best practices
- Use functional components with hooks
- Implement proper error boundaries
- Add comprehensive comments
- Write meaningful commit messages

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

### Documentation
- [Next.js Documentation](https://nextjs.org/docs)
- [Wagmi Documentation](https://wagmi.sh)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### Community
- GitHub Issues: Report bugs and request features
- Discord: Join our community for discussions
- Twitter: Follow for updates and announcements

### Troubleshooting

#### Common Issues
1. **Wallet Connection**: Ensure MetaMask is installed and unlocked
2. **Network Issues**: Check if you're on the correct network (Base)
3. **Transaction Failures**: Verify gas settings and contract addresses
4. **API Errors**: Check backend server status and API keys

#### Debug Mode
Enable debug logging by setting:
```env
NEXT_PUBLIC_DEBUG=true
```

---

**Note**: This frontend application is designed to work with the BUNDSX backend server and smart contracts. Ensure all dependencies are properly configured before running the application.
