'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'

export function ConnectWallet() {
  return (
    <ConnectButton 
      chainStatus="icon"
      showBalance={false}
      accountStatus={{
        smallScreen: 'avatar',
        largeScreen: 'full',
      }}
    />
  )
} 