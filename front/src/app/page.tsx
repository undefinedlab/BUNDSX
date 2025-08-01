'use client'

import { useState, useEffect } from 'react'
import { Coins, FileText, Wallet, Home as HomeIcon } from 'lucide-react'
import { ConnectWallet } from '../components/connect-wallet'
import { Home as HomeComponent } from '../components/pages/home'
import { Assets } from '../components/pages/assets'

interface NFT {
  id: string
  name: string
  image: string
  collection: string
  floorPrice: number
  chain: 'ethereum' | 'base'
  tokenId: string
  contractAddress: string
  selected?: boolean
  maxOffer?: string
  maxOfferBidder?: string
  slug?: string
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'home' | 'assets' | 'markets' | 'tokens'>('home')
  const [selectedNFTs, setSelectedNFTs] = useState<NFT[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Simulate loading both content and image together
    const timer = setTimeout(() => {
      setIsLoaded(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 relative overflow-hidden">
      {/* Subtle animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top right wallet */}
        <div className="absolute top-6 right-6 z-20">
          <ConnectWallet />
        </div>

        {/* Main content area */}
        <main className="flex-1 flex items-center justify-center px-4 py-8 pt-20">
          {/* Home screen */}
          {activeTab === 'home' && <HomeComponent />}

          {/* Assets tab */}
          {activeTab === 'assets' && (
            <div className="w-full max-w-6xl mx-auto space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Your Assets</h2>
                <p className="text-gray-600">Manage your NFT collection and view best offers</p>
              </div>
              <Assets
                selectedNFTs={selectedNFTs}
                onSelectedNFTsChange={setSelectedNFTs}
              />
            </div>
          )}

          {/* Bonds tab */}
          {activeTab === 'markets' && (
            <div className="w-full max-w-6xl mx-auto space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Bond Markets</h2>
                <p className="text-gray-600">Trade fractionalized bond tokens</p>
              </div>
              <div className="bg-white/20 backdrop-blur-xl rounded-2xl p-8 border border-white/30">
                <p className="text-center text-gray-600">Markets component will be implemented here</p>
              </div>
            </div>
          )}
        </main>

        {/* Bottom navigation - detached and rounded */}
        <div className={`px-4 pb-12 transition-all duration-1000 ease-out ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>
          <nav className="backdrop-blur-xl bg-white/20 rounded-3xl py-3 mx-auto max-w-md shadow-2xl border border-white/30">
            <div className="flex justify-around">
              <button
                onClick={() => setActiveTab('home')}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 cursor-pointer ${
                  activeTab === 'home'
                    ? 'bg-white/30 text-gray-800 shadow-lg'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-white/20'
                }`}
              >
                <HomeIcon className="h-5 w-5" />
                <span className="text-[10px] font-medium">Home</span>
              </button>

              <button
                onClick={() => setActiveTab('assets')}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 cursor-pointer ${
                  activeTab === 'assets'
                    ? 'bg-white/30 text-gray-800 shadow-lg'
                    : 'text-gray-600 hover:text-purple-600 hover:bg-white/20'
                }`}
              >
                <Wallet className="h-5 w-5" />
                <span className="text-[10px] font-medium">Assets</span>
              </button>

              <button
                onClick={() => setActiveTab('markets')}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 cursor-pointer ${
                  activeTab === 'markets'
                    ? 'bg-white/30 text-gray-800 shadow-lg'
                    : 'text-gray-600 hover:text-green-600 hover:bg-white/20'
                }`}
              >
                <FileText className="h-5 w-5" />
                <span className="text-[10px] font-medium">Markets</span>
              </button>
            </div>
          </nav>
        </div>
      </div>
    </div>
  )
}
