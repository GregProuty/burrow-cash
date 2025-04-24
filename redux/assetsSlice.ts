import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

import { defaultNetwork, missingPriceTokens } from "../utils/config";
import { initialState } from "./assetState";
import { transformAssets } from "../transformers/asstets";
import getAssets from "../api/get-assets";
import getFarm from "../api/get-farm";

export const fetchAssets = createAsyncThunk("assets/fetchAssets", async (_, { rejectWithValue }) => {
  try {
    const assets = await getAssets().then(transformAssets);
    const netTvlFarm = await getFarm("NetTvl");
    return { assets, netTvlFarm };
  } catch (error) {
    console.log("Error fetching assets:", error);
    
    // When wallet is not connected, return empty data instead of rejecting
    if (error.toString().includes("account undefined does not exist") || 
        error.toString().includes("undefined method: get_config")) {
      return { assets: {}, netTvlFarm: { rewards: {} } };
    }
    
    return rejectWithValue("Failed to fetch assets and metadata. You may need to connect your wallet first.");
  }
});

export const fetchRefPrices = createAsyncThunk("assets/fetchRefPrices", async (_, { rejectWithValue }) => {
  try {
    const prices = await fetch(
      "https://raw.githubusercontent.com/NearDeFi/token-prices/main/ref-prices.json",
    ).then((r) => r.json());

    return prices;
  } catch (error) {
    console.error("Error fetching REF prices:", error);
    return rejectWithValue("Failed to fetch REF prices");
  }
});

export const assetSlice = createSlice({
  name: "assets",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchAssets.pending, (state) => {
      state.status = "fetching";
    });
    builder.addCase(fetchAssets.fulfilled, (state, action) => {
      state.data = action.payload.assets;
      state.netTvlFarm = action.payload.netTvlFarm?.rewards || {};
      state.status = action.meta.requestStatus;
      state.fetchedAt = new Date().toString();
    });
    builder.addCase(fetchAssets.rejected, (state, action) => {
      state.status = action.meta.requestStatus;
      console.error(action.payload);
      // Don't throw an error if we rejected with a value
      if (typeof action.payload !== 'string') {
        throw new Error("Failed to fetch assets and metadata");
      }
    });
    builder.addCase(fetchRefPrices.fulfilled, (state, action) => {
      missingPriceTokens.forEach((missingToken) => {
        const missingTokenId = missingToken[defaultNetwork];
        if (missingTokenId && state.data[missingTokenId] && !state.data[missingTokenId]["price"]) {
          state.data[missingTokenId]["price"] = {
            decimals: action.payload[missingToken.mainnet].decimal,
            usd: Number(action.payload[missingToken.mainnet].price),
            multiplier: "1",
          };
        }
      });
    });
    builder.addCase(fetchRefPrices.pending, (state) => {
      state.status = "fetching";
    });
    builder.addCase(fetchRefPrices.rejected, (state, action) => {
      state.status = action.meta.requestStatus;
      console.error(action.payload);
      if (typeof action.payload !== 'string') {
        throw new Error("Failed to fetch REF prices");
      }
    });
  },
});

export default assetSlice.reducer;
