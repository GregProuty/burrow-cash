import Decimal from "decimal.js";

import {
  IAssetEntry,
  IAssetDetailed,
  IUnitLptAsset,
  AssetEntry,
  ViewMethodsLogic,
  ViewMethodsREFV1,
} from "../interfaces";
import { getBurrow } from "../utils";
import { DEFAULT_PRECISION } from "./constants";
import { lpTokenPrefix } from "../utils/config";

Decimal.set({ precision: DEFAULT_PRECISION });

export const getAssets = async (): Promise<IAssetEntry[]> => {
  const { view, logicContract } = await getBurrow();
  return (
    (await view(logicContract, ViewMethodsLogic[ViewMethodsLogic.get_assets_paged])) as AssetEntry[]
  ).map(([token_id, asset]: AssetEntry) => ({
    ...asset,
    token_id,
  }));
};
export const getAssetDetaileds = async (): Promise<IAssetDetailed[]> => {
  const { view, logicContract } = await getBurrow();
  return (await view(
    logicContract,
    ViewMethodsLogic[ViewMethodsLogic.get_assets_paged_detailed],
  )) as IAssetDetailed[];
};

export const getAssetDetailed = async (token_id: string): Promise<IAssetDetailed> => {
  const { view, logicContract } = await getBurrow();
  const assetDetails: IAssetDetailed = (await view(
    logicContract,
    ViewMethodsLogic[ViewMethodsLogic.get_asset],
    {
      token_id,
    },
  )) as IAssetDetailed;

  return assetDetails;
};

// TODO REPEAT
export const getAssetsDetailed = async (): Promise<IAssetDetailed[]> => {
  // const assets: IAssetEntry[] = await getAssets();
  // const detailedAssets = await Promise.all(assets.map((asset) => getAssetDetailed(asset.token_id)));
  const detailedAssets = await getAssetDetaileds();
  const allowedTokenIds = [
    "wbtc.fakes.testnet",
    "nbtc1-nsp.testnet",
    "eth.fakes.testnet",
    "usdcc.fakes.testnet",
    "usdtt.fakes.testnet",
    "853d95.fakes.testnet",
    "token.dev-burrow.testnet",
    "dai.fakes.testnet",
  ];
  const filteredRows = detailedAssets.filter((row) => allowedTokenIds.includes(row.token_id));
  return filteredRows;
};

export const getUnitLptAssets = async (pool_ids: number[]): Promise<IUnitLptAsset> => {
  const { view, refv1Contract } = await getBurrow();
  const details = (await view(
    refv1Contract,
    ViewMethodsREFV1[ViewMethodsREFV1.get_unit_lpt_assets],
    { pool_ids },
  )) as IUnitLptAsset;
  return details;
};
