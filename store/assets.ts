import Decimal from "decimal.js";

import { IAssetEntry, IAssetDetailed, AssetEntry, ViewMethodsLogic } from "../interfaces";
import { getBurrow } from "../utils";
import { DEFAULT_PRECISION } from "./constants";
import { lpTokenPrefix } from "../utils/config";

Decimal.set({ precision: DEFAULT_PRECISION });

export const getAssets = async (): Promise<IAssetEntry[]> => {
  try {
    const { view, logicContract } = await getBurrow();
    
    if (!view || !logicContract) {
      console.warn("Cannot get assets: wallet not connected or view method unavailable");
      return [];
    }
    
    return (
      (await view(logicContract, ViewMethodsLogic[ViewMethodsLogic.get_assets_paged])) as AssetEntry[]
    ).map(([token_id, asset]: AssetEntry) => ({
      ...asset,
      token_id,
    }));
  } catch (error) {
    console.error("Error fetching assets:", error);
    return [];
  }
};

export const getAssetDetailed = async (token_id: string): Promise<IAssetDetailed | null> => {
  try {
    if (!token_id) {
      console.warn("Cannot get asset details: token_id is undefined");
      return null;
    }
    
    const { view, logicContract } = await getBurrow();
    
    if (!view || !logicContract) {
      console.warn(`Cannot get asset details for ${token_id}: wallet not connected or view method unavailable`);
      return null;
    }

    const assetDetails: IAssetDetailed = (await view(
      logicContract,
      ViewMethodsLogic[ViewMethodsLogic.get_asset],
      {
        token_id,
      },
    )) as IAssetDetailed;

    return assetDetails;
  } catch (error) {
    console.error(`Error fetching asset details for ${token_id}:`, error);
    return null;
  }
};

export const getAssetsDetailed = async (): Promise<IAssetDetailed[]> => {
  try {
    const assets: IAssetEntry[] = await getAssets();
    
    if (!assets || assets.length === 0) {
      console.info("No assets available to get detailed information");
      return [];
    }
    
    const detailedAssets = await Promise.all(
      assets.map(async (asset) => {
        if (!asset || !asset.token_id) return null;
        return getAssetDetailed(asset.token_id);
      })
    );
    
    // Filter out null values and LP tokens
    return detailedAssets
      .filter(Boolean)
      .filter((asset) => asset && asset.token_id && !asset.token_id.includes(lpTokenPrefix)) as IAssetDetailed[];
  } catch (error) {
    console.error("Error fetching detailed assets:", error);
    return [];
  }
};
