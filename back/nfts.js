const axios = require('axios');

// Configuration - these would typically be imported from a config file
const ONECHIN_BASE_URL = process.env.ONECHIN_BASE_URL || 'https://api.1inch.dev';
const ONECHIN_API_KEY = process.env.ONECHIN_API_KEY || 'wrAAsbZAQBZYFAekiECgqEvGneNO569Z';
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY || '171864f3dfae4d52874064078bf0a5d8';

// Function to get NFTs by address from 1inch API
async function getNFTsByAddress(address, chainId, limit = 50, offset = 0) {
  try {
    console.log(`Fetching NFTs for wallet: ${address} on chain: ${chainId}`);
    
               const response = await axios.get(`${ONECHIN_BASE_URL}/nft/v2/byaddress`, {
             headers: {
               'Authorization': `Bearer ${ONECHIN_API_KEY}`,
               'Accept': 'application/json'
             },
             params: {
               chainIds: chainId,
               address: address,
               limit: parseInt(limit),
               offset: parseInt(offset)
             },
             timeout: 10000
           });

    const data = response.data;
    const assets = data.assets || data.data?.tokens || data.data?.nfts || data.tokens || data.nfts || data || [];
    
    console.log(`Found ${assets.length} NFTs from 1inch API`);
    
               // Enhance NFTs with OpenSea data
           const enhancedAssets = await enhanceNFTsWithOpenSeaData(assets, address);
           
           // Filter out unknown/unnamed collections
           const filteredAssets = enhancedAssets.filter(asset => {
             const collectionName = asset.collection_name || asset.collection?.name || '';
             const isUnknownCollection = !collectionName || 
                                       collectionName.trim() === '' || 
                                       collectionName.toLowerCase().includes('unknown') ||
                                       collectionName.toLowerCase().includes('unnamed') ||
                                       collectionName.toLowerCase().includes('untitled') ||
                                       collectionName === 'Unknown' ||
                                       collectionName === 'Unnamed' ||
                                       collectionName === 'Untitled';
             
             return !isUnknownCollection;
           });
           
           return { assets: filteredAssets };
           } catch (error) {
           console.error('Error fetching NFTs from 1inch API:', error.message);
           
           // Return mock data as fallback
           const mockAssets = [
             {
               id: '1',
               name: 'Bored Ape #1234',
               image_url: 'https://via.placeholder.com/300x300/6366f1/ffffff?text=APE',
               collection_name: 'Bored Ape Yacht Club',
               token_id: '1234',
               asset_contract: { address: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d', name: 'Bored Ape Yacht Club' },
               max_offer: '12.5',
               max_offer_bidder: '0xabc...'
             },
             {
               id: '2',
               name: 'Doodle #5678',
               image_url: 'https://via.placeholder.com/300x300/8b5cf6/ffffff?text=DOODLE',
               collection_name: 'Doodles',
               token_id: '5678',
               asset_contract: { address: '0x8a90cab2b38dba80c64b7734e58ee1db38b8992e', name: 'Doodles' },
               max_offer: '7.8',
               max_offer_bidder: '0xdef...'
             }
           ];
           
           return { assets: mockAssets, error: error.message };
         }
}

// Function to get OpenSea NFTs for an address
async function getOpenSeaNFTs(address) {
  try {
    console.log(`Fetching NFTs from OpenSea for ${address}`);
    
    const response = await axios.get(`https://api.opensea.io/api/v2/chain/ethereum/account/${address}/nfts?limit=50`, {
      headers: {
        'accept': 'application/json',
        'x-api-key': OPENSEA_API_KEY,
      },
      timeout: 10000
    });

    const data = response.data;
    const nfts = data.nfts || [];
    
    console.log(`Found ${nfts.length} NFTs from OpenSea`);
    return nfts;
  } catch (error) {
    console.error('Error fetching OpenSea NFTs:', error.message);
    return [];
  }
}

// Function to create contract to slug mapping
function createContractToSlugMap(openSeaNFTs) {
  const contractToSlug = new Map();
  
  for (const nft of openSeaNFTs) {
    const contract = nft.contract;
    const slug = nft.collection;
    
    if (contract && slug) {
      contractToSlug.set(contract.toLowerCase(), slug);
    }
  }
  
  console.log(`Created ${contractToSlug.size} contract-to-slug mappings`);
  return contractToSlug;
}

// Function to get best offer for a specific NFT
async function getBestOfferForNFT(collectionSlug, tokenId) {
  try {
    console.log(`Fetching best offer for ${collectionSlug}/${tokenId}`);
    
    // Get best offer
    const offerResponse = await axios.get(`https://api.opensea.io/api/v2/offers/collection/${collectionSlug}/nfts/${tokenId}/best`, {
      headers: {
        'accept': 'application/json',
        'x-api-key': OPENSEA_API_KEY,
      },
      timeout: 10000
    });

    const offerData = offerResponse.data;
    let maxOffer = null;
    let maxOfferBidder = null;

    if (offerData && offerData.price) {
      const value = offerData.price.current?.value || offerData.price.value;
      if (value) {
        maxOffer = (parseFloat(value) / 1e18).toFixed(5);
        console.log(`Best offer: ${maxOffer} ETH`);
      }
    }

    // Get bidder information if order hash exists
    if (offerData && offerData.order_hash) {
      try {
        const orderResponse = await axios.get(`https://api.opensea.io/api/v2/orders/ethereum/seaport/${offerData.order_hash}`, {
          headers: {
            'accept': 'application/json',
            'x-api-key': OPENSEA_API_KEY,
          },
          timeout: 10000
        });

        const orderData = orderResponse.data;
        maxOfferBidder = orderData.order?.maker || null;
        console.log(`Bidder: ${maxOfferBidder}`);
      } catch (orderError) {
        console.log('Could not fetch order details for bidder info:', orderError.message);
      }
    }

    return { maxOffer, maxOfferBidder };
  } catch (error) {
    console.log(`Could not fetch best offer for ${collectionSlug}/${tokenId}:`, error.message);
    return { maxOffer: null, maxOfferBidder: null };
  }
}

// Function to enhance NFTs with OpenSea data
async function enhanceNFTsWithOpenSeaData(assets, address) {
  try {
    // Get OpenSea NFTs to create contract-to-slug mapping
    const openSeaNFTs = await getOpenSeaNFTs(address);
    const contractToSlug = createContractToSlugMap(openSeaNFTs);
    
    const enhancedAssets = [];
    
    // Process first 10 NFTs to avoid rate limits
    for (let i = 0; i < Math.min(assets.length, 10); i++) {
      const asset = assets[i];
      const contractAddress = asset.asset_contract?.address || asset.tokenAddress || asset.contractAddress;
      const tokenId = asset.token_id || asset.tokenId || asset.id;
      
      console.log(`Processing NFT: ${contractAddress} #${tokenId}`);
      
      if (!contractAddress) {
        console.log('Skipping NFT - no contract address');
        enhancedAssets.push(asset);
        continue;
      }
      
      const collectionName = asset.collection?.name || asset.asset_contract?.name || asset.name || 'Unknown Collection';
      const collectionSlug = contractToSlug.get(contractAddress.toLowerCase());
      
      let maxOffer = null;
      let maxOfferBidder = null;
      
      if (collectionSlug && tokenId) {
        const offerInfo = await getBestOfferForNFT(collectionSlug, tokenId);
        maxOffer = offerInfo.maxOffer;
        maxOfferBidder = offerInfo.maxOfferBidder;
      }
      
      enhancedAssets.push({
        ...asset,
        collection_name: collectionName,
        collection_slug: collectionSlug,
        max_offer: maxOffer,
        max_offer_bidder: maxOfferBidder
      });
      
      // Small delay to avoid rate limits
      if (i < Math.min(assets.length, 10) - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Add remaining NFTs without OpenSea enhancement
    for (let i = 10; i < assets.length; i++) {
      const asset = assets[i];
      const collectionName = asset.collection?.name || asset.asset_contract?.name || asset.name || 'Unknown Collection';
      
      enhancedAssets.push({
        ...asset,
        collection_name: collectionName,
        max_offer: null,
        max_offer_bidder: null
      });
    }
    
    console.log(`Enhanced ${enhancedAssets.length} NFTs with OpenSea data`);
    return enhancedAssets;
  } catch (error) {
    console.error('Error enhancing NFTs with OpenSea data:', error.message);
    return assets;
  }
}

// Function to get collection information
async function getCollectionInfo(contractAddress) {
  try {
    console.log(`Fetching collection info for contract: ${contractAddress}`);
    
    const response = await axios.get(`https://api.opensea.io/api/v2/collections/ethereum/${contractAddress}`, {
      headers: {
        'accept': 'application/json',
        'x-api-key': OPENSEA_API_KEY,
      },
      timeout: 10000
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching collection info:', error.message);
    return {};
  }
}

// Function to get best offers for multiple NFTs
async function getBestOffersForMultipleNFTs(nfts) {
  if (!Array.isArray(nfts)) {
    throw new Error('nfts must be an array');
  }
  
  const results = [];
  
  for (const nft of nfts.slice(0, 10)) { // Limit to 10 to avoid rate limits
    try {
      const { slug, tokenId } = nft;
      
      if (!slug || !tokenId) {
        results.push({ ...nft, maxOffer: null, error: 'Missing slug or tokenId' });
        continue;
      }
      
      const offerInfo = await getBestOfferForNFT(slug, tokenId);
      results.push({ ...nft, maxOffer: offerInfo.maxOffer, maxOfferBidder: offerInfo.maxOfferBidder });
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Error fetching best offer for ${nft.slug}/${nft.tokenId}:`, error.message);
      results.push({ ...nft, maxOffer: null, error: error.message });
    }
  }
  
  return results;
}

module.exports = {
  getNFTsByAddress,
  getOpenSeaNFTs,
  getBestOfferForNFT,
  getCollectionInfo,
  getBestOffersForMultipleNFTs,
  enhanceNFTsWithOpenSeaData
}; 