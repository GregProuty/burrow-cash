import { IAssetDetailed, IMetadata } from "../interfaces/asset";
import { transformAssetFarms } from "./farms";
import { Assets } from "../redux/assetState";

export function transformAssets({
  assets,
  metadata,
}: {
  assets?: IAssetDetailed[];
  metadata?: IMetadata[];
} = {}): Assets {
  // Return empty object if assets or metadata are undefined
  if (!assets || !metadata || assets.length === 0 || metadata.length === 0) {
    console.info("No assets or metadata available for transformation");
    return {};
  }
  
  const data = assets.reduce((map, asset) => {
    if (!asset || !asset.token_id) {
      return map;
    }
    
    const assetMetadata = metadata.find((m) => m && m.token_id === asset.token_id) as IMetadata;
    if (!assetMetadata || !asset.config) {
      console.debug(`Missing metadata or config for asset ${asset.token_id}`);
      return map;
    }
    
    map[asset.token_id] = {
      metadata: assetMetadata,
      ...asset,
      farms: transformAssetFarms(asset.farms),
    };
    return map;
  }, {});

  return data;
}
