import { getAllMetadata, getAssetsDetailed, getPrices } from "../store";

const getPrice = (tokenId, priceResponse, metadata) => {
  if (!priceResponse[tokenId]) return null;

  const decimals = metadata[tokenId]?.decimals || 24;
  const price = priceResponse[tokenId].price;
  const multiplier = priceResponse[tokenId].multiplier || "1";

  return {
    decimals,
    usd: price,
    multiplier,
  };
};

export default async function getAssets() {
  try {
    // Get assets from API
    const metadata = await getAllMetadata();
    const priceData = await getPrices();
    const assets = await getAssetsDetailed();

    // Return enriched assets with price data
    return Object.entries(assets).reduce((acc, [tokenId, asset]) => {
      const price = getPrice(tokenId, priceData, metadata);
      return {
        ...acc,
        [tokenId]: {
          ...asset,
          price,
          tokenId,
          metadata: metadata[tokenId],
        },
      };
    }, {});
  } catch (error) {
    console.error('Failed to get assets completely', error);
    // Return empty object as fallback so UI can still render without crashing
    return {};
  }
}
