import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, sepolia, base } from 'wagmi/chains'

// For development, use a placeholder project ID
// In production, replace with your actual WalletConnect project ID from https://cloud.walletconnect.com/
const projectId = 'YOUR_PROJECT_ID'

export const config = getDefaultConfig({
  appName: 'BUNDSX',
  projectId,
  chains: [mainnet, sepolia, base],
  ssr: true,
}) 