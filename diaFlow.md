```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                          NFT BOND FRACTIONALIZATION DAPP                                          │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

                                              ┌─────────────┐
                                              │    USER     │
                                              │   WALLET    │
                                              │ 👤 Multiple │
                                              │    NFTs     │
                                              └──────┬──────┘
                                                     │
                                          1. Approve + Submit NFT Assets
                                                     │
                                                     ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        BOND CREATION PHASE                                                        │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                    │
│    ┌─────────────────────────────────────┐                    ┌──────────────────────────────────────────┐    │
│    │        BOND FACTORY                 │  2. Lock NFTs      │         NFT STORAGE                      │    │
│    │     🏭 Main Contract                │ ─────────────────▶ │      Inside BondFactory                  │    │
│    │                                     │ (ERC721/ERC1155)   │   ┌─────┬─────┬─────┬─────┐               │    │
│    │ • createBond()                      │                    │   │NFT 1│NFT 2│NFT 3│ ... │               │    │
│    │ • validateAssetOwnership()          │                    │   └─────┴─────┴─────┴─────┘               │    │
│    │ • _transferAssetsToFactory()        │                    │   assetLocked[contract][tokenId] = true   │    │
│    │ • nextBondId++                      │                    └──────────────────────────────────────────┘    │
│    └─────────────┬───────────────────────┘                                                                      │
│                  │                                                                                              │
│                  │ 3. Deploy Clone via Clones.createClone()                                                    │
│                  ▼                                                                                              │
│    ┌─────────────────────────────────────┐                    ┌──────────────────────────────────────────┐    │
│    │         BOND NFT CLONE              │                    │        BOND REGISTRY                     │    │
│    │      💎 ERC721 Token                │◄─── 4. Register ───│     🗂️ Metadata Storage                  │    │
│    │                                     │   Bond Metadata    │                                          │    │
│    │ • initialize(bondId, creator)       │                    │ • bonds[bondId] = BondData               │    │
│    │ • Single NFT = Bundle of Assets     │                    │ • userBonds[creator].push(bondId)       │    │
│    │ • Can be fractionalized later       │                    │ • bondName, description, bondNumber      │    │
│    │ • Holds fee vault (ETH)             │                    │ • totalBondsCreated++                   │    │
│    │ • Market enabler                    │                    │ • totalNFTsLocked += assets.length      │    │
│    └─────────────┬───────────────────────┘                    └──────────────────────────────────────────┘    │
│                  │                                                                                              │
│                  │ 5. Optional: Set CurveAMM address                                                           │
│                  ▼                                                                                              │
│    ┌─────────────────────────────────────┐                                                                     │
│    │      CURVE AMM REFERENCE            │                                                                     │
│    │   📈 bondNFT.setCurveAMM()          │                                                                     │
│    └─────────────────────────────────────┘                                                                     │
│                                                                                                                 │
└─────────────────────────────────────────────────┬───────────────────────────────────────────────────────────┘
                                                  │
                              6. User Decides: Keep Whole OR Fractionalize
                                                  │
                          ┌───────────────────────┴────────────────────────┐
                          │                                                │
                          ▼ KEEP WHOLE                         FRACTIONALIZE ▼
┌─────────────────────────────────────┐              ┌─────────────────────────────────────────────────────────┐
│         WHOLE BOND PATH             │              │                FRACTIONALIZATION PHASE                   │
│                                     │              ├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │              │                                                         │
│ │       BOND NFT                  │ │              │  ┌─────────────────────────────────────────────────────┐ │
│ │    💎 Single Token              │ │              │  │              BOND NFT                              │ │
│ │                                 │ │              │  │          💎 Gets Fractionalized                    │ │
│ │ • Can be transferred            │ │              │  │                                                     │ │
│ │ • Can be sold on marketplaces   │ │              │  │ • markFragmentalized(totalSupply)                  │ │
│ │ • Direct redemption available   │ │              │  │ • isFragmentalized = true                          │ │
│ │                                 │ │              │  │ • Enables vault redemption system                  │ │
│ └─────────────────────────────────┘ │              │  └─────────────┬───────────────────────────────────────┘ │
│                                     │              │                │                                         │
│              OR                     │              │                │ 7. Deploy Market                       │
│                                     │              │                ▼                                         │
│ ┌─────────────────────────────────┐ │              │  ┌─────────────────────────────────────────────────────┐ │
│ │    DEFRAGMENTALIZATION          │ │              │  │              CURVE AMM                             │ │
│ │   🔄 Convert Back to Whole      │ │              │  │          📈 Bonding Curve Market                   │ │
│ │                                 │ │              │  │                                                     │ │
│ │ • defragmentalizeBond()         │ │              │  │ • createMarket(bondId, supply, tokensForSale)      │ │
│ │ • Requires no tokens sold       │ │              │  │ • Exponential curve: price = n² × PRICE_SCALE      │ │
│ │ • Closes CurveAMM market        │ │              │  │ • 2.5% fees to BondNFT vault                      │ │
│ │ • BondNFT.defragmentalize()     │ │              │  │ • Deploy ERC20 via BondTokenFactory                │ │
│ └─────────────────────────────────┘ │              │  └─────────────┬───────────────────────────────────────┘ │
└─────────────────────────────────────┘              │                │                                         │
                                                     │                │ 8. Create Bond Token                    │
                                                     │                ▼                                         │
                                                     │  ┌─────────────────────────────────────────────────────┐ │
                                                     │  │          BOND TOKEN FACTORY                         │ │
                                                     │  │           🏗️ ERC20 Deployer                        │ │
                                                     │  │                                                     │ │
                                                     │  │ • createBondToken(bondId)                          │ │
                                                     │  │ • Deploys unique ERC20 per bond                    │ │
                                                     │  │ • BondToken with mint/burn capabilities            │ │
                                                     │  └─────────────┬───────────────────────────────────────┘ │
                                                     │                │                                         │
                                                     │                │ 9. Deploy ERC20                        │
                                                     │                ▼                                         │
                                                     │  ┌─────────────────────────────────────────────────────┐ │
                                                     │  │             BOND TOKEN                              │ │
                                                     │  │          🪙 ERC20 Contract                          │ │
                                                     │  │                                                     │ │
                                                     │  │ • Mintable/Burnable ERC20                          │ │
                                                     │  │ • Represents fractional bond ownership             │ │
                                                     │  │ • Tradeable on bonding curve                       │ │
                                                     │  │ • Can be used for vault redemption                 │ │
                                                     │  └─────────────────────────────────────────────────────┘ │
                                                     └─────────────────────────────────────────────────────────┘
                                                                            │
                                                             10. Market is Live & Active
                                                                            │
                                                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                          TRADING PHASE                                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                   │
│  ┌─────────────────┐              ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │     TRADERS     │  11. Trade   │                        CURVE AMM                                        │  │
│  │   👥 Multiple   │ ◄──────────► │                    📈 Active Market                                     │  │
│  │     Users       │  Bond Tokens │                                                                         │  │
│  │                 │              │  BUY FLOW:                          SELL FLOW:                         │  │
│  │ • Buy tokens    │              │  • Calculate cost for N tokens      • Calculate refund for N tokens    │  │
│  │ • Sell tokens   │              │  • Collect ETH payment               • Burn user's ERC20 tokens        │  │
│  │ • Price impact  │              │  • Mint ERC20 to buyer               • Send ETH back (minus fees)      │  │
│  │ • Speculation   │              │  • Update curve state                • Update curve state              │  │
│  └─────────────────┘              │  • Send fees to BondNFT vault       • Send fees to BondNFT vault     │  │
│                                   │                                                                         │  │
│                                   │  PRICING: Token N costs = N² × PRICE_SCALE / CURVE_STEEPNESS          │  │
│                                   │  Token 1: ~0.001 ETH | Token 100: ~0.1 ETH | Token 500: ~2.5 ETH     │  │
│                                   └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                            │                                     │
│                                                              12. Fees Accumulate                                │
│                                                                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                    BOND NFT VAULT                                                        │  │
│  │                               💰 Fee Collection System                                                   │  │      
│  │                                                                                                           │  │
│  │ • Receives 2.5% of all trades                                                                            │  │
│  │ • ETH accumulates in contract                                                                            │  │
│  │ • Can be used for proportional redemption                                                                │  │
│  │ • addToVault() called by CurveAMM                                                                        │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                                   │
└───────────────────────────────────────────────────────┬───────────────────────────────────────────────────────┘
                                                        │
                                             13. Eventually: Redemption
                                                        │
                                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                         REDEMPTION PHASE                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                   │
│                              ┌─────────────────────────────┐                                                    │
│                              │    REDEMPTION TRIGGER       │                                                    │
│                              │                             │                                                    │
│                              │ A) Creator: redeemBond()    │                                                    │
│                              │ B) Creator: defragmentalize │                                                    │
│                              │ C) BondNFT: vault redeem    │                                                    │
│                              └─────────────┬───────────────┘                                                    │
│                                            │                                                                     │
│                                            ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              BOND FACTORY REDEMPTION                                                     │  │
│  │                           🏭 NFT Release Controller                                                       │  │
│  │                                                                                                           │  │
│  │  VALIDATION:                                   EXECUTION:                                                 │  │
│  │  • Check bond exists                          • Burn Bond NFT (if exists)                               │  │
│  │  • Verify caller permissions                  • Transfer all locked NFTs                                │  │
│  │  • Ensure not already redeemed                • Mark assetLocked[contract][tokenId] = false            │  │
│  │  • Check fragmentation status                 • Set BondData.isRedeemed = true                         │  │
│  │                                               • Update stats: totalBondsRedeemed++                     │  │
│  │                                               • Update stats: totalNFTsLocked -= assets.length         │  │
│  └─────────────────────────────────┬───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                                                             │
│                                    │ 14. Release NFTs                                                           │
│                                    ▼                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                   NFT RELEASE                                                            │  │
│  │                              🎯 Back to Recipients                                                       │  │
│  │                                                                                                           │  │
│  │ ┌─────────┬─────────┬─────────┬─────────┐      ┌──────────────────────────────────────────────────────┐ │  │
│  │ │  NFT 1  │  NFT 2  │  NFT 3  │   ...   │ ───► │            RECIPIENT WALLET                          │ │  │
│  │ └─────────┴─────────┴─────────┴─────────┘      │        👤 Creator or Token Holders                   │ │  │
│  │                                                 │                                                      │ │  │
│  │ • _transferSingleAsset() for each NFT          │ • Original NFTs returned                             │ │  │
│  │ • Supports both ERC721 and ERC1155             │ • Bond lifecycle complete                            │ │  │
│  │ • safeTransferFrom() to recipient              │ • Assets unlocked for new bonds                     │ │  │
│  └─────────────────────────────────────────────────┴──────────────────────────────────────────────────────┘  │
│                                                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                          EVENT SYSTEM                                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                   │
│  📡 BOND FACTORY EVENTS:                          📡 CURVE AMM EVENTS:                                          │
│  • BondCreated(bondId, creator, ...)             • MarketCreated(bondId, creator, ...)                         │
│  • BondRedeemed(bondId, creator, ...)            • TokensPurchased(bondId, buyer, ...)                         │
│  • NFTsReleased(bondId, recipient, ...)          • TokensSold(bondId, seller, ...)                             │
│  • BondDefragmentalized(bondId, creator, ...)                                                                    │
│  • CurveAMMSet(curveAMM)                         📡 BOND NFT EVENTS:                                             │
│                                                  • Transfer(from, to, tokenId)                                   │
│  📊 STATISTICS TRACKING:                         • Approval(owner, approved, tokenId)                           │
│  • totalBondsCreated                             • VaultDeposit(amount)                                          │
│  • totalNFTsLocked                                                                                               │
│  • totalBondsRedeemed                            📈 MARKET STATISTICS:                                           │
│  • totalVolumeETH                                • totalMarketsCreated                                           │
│  • totalFeesCollected                            • totalVolumeETH                                                │
│                                                  • totalFeesCollected                                            │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Legend:
🏭 = Contract Factory    💎 = NFT Token         📈 = AMM/Trading       🪙 = ERC20 Token
👤 = User/Wallet        🗂️ = Data Storage      📡 = Events            💰 = Fee/Vault System
🎯 = Target/Output      🔄 = Process Flow      ⚡ = State Change      📊 = Statistics
```
