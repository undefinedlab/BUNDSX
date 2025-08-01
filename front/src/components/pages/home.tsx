'use client'

import { useState, useEffect } from 'react'
import Lottie from 'lottie-react'
import infiniteRainbow from '../assets/Infinite Rainbow.json'

export function Home() {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className={`max-w-7xl mx-auto px-4 transition-all duration-1000 ease-out ${
        isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}>
        
                {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-center">
          
          {/* Left section */}
          <div className="text-right space-y-4 max-w-sm mr-10 mt-30 opacity-20 hover:opacity-100 transition-opacity duration-300">
          <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-800 leading-tight">
                Transform Your NFTs Into
                <span className="block text-blue-600">Liquid Assets</span>
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                Unlock hidden value in your NFT collection. Bond your NFTs and mint tradable tokens — giving you instant access to liquidity without selling your digital art.
              </p>
            </div>
            
        
          </div>
                     {/* Center - Logo and Brand */}
           <div className="flex flex-col items-center justify-center">
             {/* Lottie Animation Logo */}
             <div className="flex justify-center mb-[-400px]">
               <div className="w-180 h-180">
                 <Lottie 
                   animationData={infiniteRainbow} 
                   loop={true}
                   autoplay={true}
                 />
               </div>
             </div>
             
             <h1 className="text-9xl font-bold text-gray-800 mb-6 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
               BUNDS
             </h1>
             <p className="text-2xl text-gray-600 text-center">NFT-Backed Tokenized Bond Loans</p>
             <p className="text-xl text-gray-500 text-center">on pump.fun like trading curves</p>
           </div>

                     {/* Right section */}
           <div className="text-left space-y-4 max-w-sm ml-10 mt-30 opacity-20 hover:opacity-100 transition-opacity duration-300">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-800 leading-tight">
                Trade, Earn, and Exit with
                <span className="block text-purple-600">Vault-Backed Floor</span>
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                BondTokens aren't just hype — every trade feeds a vault that backs your tokens with real ETH. Whether you flip or hold, there's a floor price safety net — and the more volume, the higher it grows.
              </p>
            </div>
            
           
          </div>
        </div>
      </div>
    </div>
  )
} 