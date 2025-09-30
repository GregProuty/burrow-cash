import BN from "bn.js";
import Decimal from "decimal.js";
import { Account, Contract } from "near-api-js";

import { DEFAULT_PRECISION, NANOS_PER_YEAR, NEAR_DECIMALS } from "./constants";
import { getBurrow } from "../utils";
import { ViewMethodsOracle, IAssetPrice, IPrices, ChangeMethodsLogic } from "../interfaces";
import { isRegistered } from "./wallet";

Decimal.set({ precision: DEFAULT_PRECISION });

export const aprToRate = (apr: string): string => {
  const exp = new Decimal(1).dividedBy(new Decimal(NANOS_PER_YEAR));
  const base = new Decimal(apr).dividedBy(new Decimal(100));
  const result: Decimal = base.plus(new Decimal(1)).pow(exp);
  const roundRes: Decimal = result.mul(new Decimal(10).pow(new Decimal(27)));
  return roundRes.toPrecision(12);
};

export const rateToApr = (rate: string): string => {
  const apr = new Decimal(100)
    .mul(new Decimal(rate).div(new Decimal(10).pow(new Decimal(27))).pow(NANOS_PER_YEAR))
    .sub(100);

  return apr.toFixed(2);
};

// Cache for getPrices to reduce excessive calls and logging
let pricesCache: IPrices | undefined = undefined;
let pricesCacheTime = 0;
let lastPricesWarningTime = 0;
const PRICES_CACHE_DURATION = 30000; // 30 seconds
const WARNING_THROTTLE_DURATION = 10000; // 10 seconds

export const getPrices = async (): Promise<IPrices | undefined> => {
  try {
    // Return cached prices if still valid
    const now = Date.now();
    if (pricesCache && (now - pricesCacheTime) < PRICES_CACHE_DURATION) {
      return pricesCache;
    }

    const { view, oracleContract, account } = await getBurrow();

    if (!account || !account.accountId) {
      // Throttle warning messages to reduce log spam
      if ((now - lastPricesWarningTime) > WARNING_THROTTLE_DURATION) {
        console.warn("Cannot fetch prices: wallet not connected");
        lastPricesWarningTime = now;
      }
      return undefined;
    }

    if (!oracleContract) {
      // Throttle warning messages to reduce log spam
      if ((now - lastPricesWarningTime) > WARNING_THROTTLE_DURATION) {
        console.warn("Cannot fetch prices: oracleContract not available (config may not be loaded yet)");
        lastPricesWarningTime = now;
      }
      return undefined;
    }

    const priceResponse: IPrices = (await view(
      oracleContract,
      ViewMethodsOracle[ViewMethodsOracle.get_price_data],
    )) as IPrices;

    if (priceResponse) {
      priceResponse.prices = priceResponse?.prices.map((assetPrice: IAssetPrice) => ({
        ...assetPrice,
        price: assetPrice.price
          ? {
              ...assetPrice.price,
              usd: new Decimal(assetPrice.price?.multiplier || 0).div(10000).toNumber(),
            }
          : null,
      }))!;
      
      // Cache successful response
      pricesCache = priceResponse;
      pricesCacheTime = now;
    }

    return priceResponse;
  } catch (err: any) {
    console.error("Getting prices failed: ", err.message);
    return undefined;
  }
};

export const expandTokenDecimal = (
  value: string | number | Decimal | undefined | null,
  decimals: string | number | undefined | null,
): Decimal => {
  if (value === undefined || value === null || decimals === undefined || decimals === null) {
    console.warn('expandTokenDecimal received undefined or null values', { value, decimals });
    return new Decimal(0);
  }
  
  try {
    return new Decimal(value).mul(new Decimal(10).pow(decimals));
  } catch (error) {
    console.error('Error in expandTokenDecimal:', error);
    return new Decimal(0);
  }
};

export const expandToken = (
  value: string | number | Decimal | undefined | null,
  decimals: string | number | undefined | null,
  fixed?: number,
): string => {
  if (value === undefined || value === null || decimals === undefined || decimals === null) {
    console.warn('expandToken received undefined or null values', { value, decimals });
    return '0';
  }
  
  try {
    return expandTokenDecimal(value, decimals).toFixed(fixed);
  } catch (error) {
    console.error('Error in expandToken:', error);
    return '0';
  }
};

export const shrinkToken = (
  value: string | number | undefined | null,
  decimals: string | number | undefined | null,
  fixed?: number,
): string => {
  if (value === undefined || value === null || decimals === undefined || decimals === null) {
    console.warn('shrinkToken received undefined or null values', { value, decimals });
    return '0';
  }
  
  try {
    return new Decimal(value).div(new Decimal(10).pow(decimals)).toFixed(fixed);
  } catch (error) {
    console.error('Error in shrinkToken:', error);
    return '0';
  }
};

export const getContract = async (
  account: Account,
  contractAddress: string,
  viewMethods: any,
  changeMethods: any,
): Promise<Contract> => {
  const contract: Contract = new Contract(account, contractAddress, {
    // View methods are read only. They don't modify the state, but usually return some value.
    viewMethods: Object.values(viewMethods)
      .filter((m) => typeof m === "string")
      .map((m) => m as string),
    // Change methods can modify the state. But you don't receive the returned value when called.
    changeMethods: Object.values(changeMethods)
      .filter((m) => typeof m === "string")
      .map((m) => m as string),
  });

  return contract;
};

export const registerNearFnCall = async (accountId: string, contract: Contract) =>
  !(await isRegistered(accountId, contract))
    ? [
        {
          methodName: ChangeMethodsLogic[ChangeMethodsLogic.storage_deposit],
          attachedDeposit: new BN(expandToken(0.00125, NEAR_DECIMALS)),
          gas: new BN("5000000000000"),
        },
      ]
    : [];
