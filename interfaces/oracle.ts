export interface IPrice {
  decimals: number;
  multiplier: string;
  usd?: number;
}

export interface IAssetPrice {
  asset_id: string;
  price: IPrice | null;
}

export interface IPrices {
  prices: IAssetPrice[];
  recency_duration_sec: number;
  timestamp: string;
}
export interface IPythPrice {
  price: string;
  conf: string;
  expo: number;
  publish_time: number;
}
