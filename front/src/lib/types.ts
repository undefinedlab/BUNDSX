export interface PumpParams {
  totalSupply: string
  tokensForSale: string
}

export interface Bond {
  bondId: string
  creator: string
  bondNFTContract: string
  isRedeemed: boolean
  createdAt: string
  assetCount: number
  bondName: string
  description: string
  bondNumber: string
  error?: boolean
} 