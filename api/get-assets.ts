import { getAllMetadata, getAssetsDetailed, getPrices } from "../store";

const getPrice = (tokenId, priceResponse, metadata) => {
  if (!priceResponse || !priceResponse[tokenId]) return null;

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
    const assets = await getAssetsDetailed();
    const metadata = await getAllMetadata(assets.map((a) => a?.token_id).filter(Boolean));
    const priceData = await getPrices();

    // Return enriched assets with price data
    return Object.entries(assets || {}).reduce((acc, [tokenId, asset]) => {
      const price = getPrice(tokenId, priceData || {}, metadata || {});
      return {
        ...acc,
        [tokenId]: {
          ...asset,
          price,
          tokenId,
          metadata: (metadata || {})[tokenId],
        },
      };
    }, {} as any);
  } catch (error) {
    console.error('Failed to get assets completely', error);
    // Return empty object as fallback so UI can still render without crashing
    return {};
  }
}
