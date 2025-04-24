import { Contract } from "near-api-js";
import BN from "bn.js";
import Decimal from "decimal.js";

import { defaultNetwork, LOGIC_CONTRACT_NAME } from "./config";
import { nearMetadata, wooMetadata, sfraxMetadata, fraxMetadata } from "../components/Assets";

import {
  ChangeMethodsLogic,
  ChangeMethodsOracle,
  ViewMethodsLogic,
  ViewMethodsOracle,
} from "../interfaces/contract-methods";
import { IBurrow, IConfig } from "../interfaces/burrow";
import { getContract } from "../store";

import { getWalletSelector, getAccount, functionCall } from "./wallet-selector-compat";
import { UIAsset } from "../interfaces";

export const getViewAs = () => {
  const url = new URL(window.location.href.replace("/#", ""));
  const searchParams = new URLSearchParams(url.search);
  return searchParams.get("viewAs");
};

interface GetBurrowArgs {
  fetchData?: (id: string) => void | null;
  hideModal?: () => void | null;
  signOut?: () => void | null;
}

let selector;
let burrow: IBurrow;
// let resetBurrow = true;
let fetchDataCached;
let hideModalCached;
let signOutCached;

export const nearNativeTokens = ["wrap.near", "wrap.testnet"];

const nearTokenIds = {
  mainnet: "wrap.near",
  testnet: "wrap.testnet",
};

export const nearTokenId = nearTokenIds[defaultNetwork] || nearTokenIds.testnet;

export const getBurrow = async ({
  fetchData,
  hideModal,
  signOut,
}: GetBurrowArgs = {}): Promise<IBurrow> => {
  /// because it's being called by multiple components on startup
  /// all calls wait until setup is complete and then return burrow instance promise
  const getBurrowInternal = async () => {
    if (burrow) return burrow;
    await new Promise((res) => {
      setTimeout(() => {
        res({});
      }, 250);
    });
    return getBurrowInternal();
  };
  // if (!resetBurrow) return getBurrowInternal();
  // resetBurrow = false;

  const changeAccount = async (accountId) => {
    if (fetchData) fetchData(accountId);
  };

  if (!selector) {
    selector = await getWalletSelector({
      onAccountChange: changeAccount,
    });
  }
  const account = await getAccount(getViewAs());

  if (!fetchDataCached && !!fetchData) fetchDataCached = fetchData;
  if (!hideModalCached && !!hideModal) hideModalCached = hideModal;
  if (!signOutCached && !!signOut)
    signOutCached = async () => {
      if (!selector) return;
      const wallet = await selector.wallet();
      await wallet.signOut().catch((err) => {
        console.error("Failed to sign out", err);
      });
      if (hideModal) hideModal();
      signOut(); // position
    };
  const signIn = () => selector.signIn();

  const view = async (
    contract: Contract,
    methodName: string,
    args: Record<string, unknown> = {},
    json = true,
  ): Promise<Record<string, any> | string> => {
    try {
      const viewAccount = await getAccount(getViewAs());
      return await viewAccount.viewFunction({
        contractId: contract.contractId,
        methodName,
        args,
        parse: (data: Uint8Array) => {
          const result = Buffer.from(data).toString();
          return json ? JSON.parse(result) : result;
        }
      });
    } catch (err: any) {
      console.error(
        `view failed on ${contract.contractId} method: ${methodName}, ${JSON.stringify(args)}`,
      );
      throw err;
    }
  };

  const call = async (
    contract: Contract,
    methodName: string,
    args: Record<string, unknown> = {},
    deposit = "1",
  ) => {
    const { contractId } = contract;
    const gas = new BN(50000000000000);
    const attachedDeposit = new BN(deposit);

    return functionCall({
      contractId,
      methodName,
      args,
      gas,
      attachedDeposit,
    }).catch((e) => console.error(e));
  };

  const logicContract: Contract = await getContract(
    account,
    LOGIC_CONTRACT_NAME,
    ViewMethodsLogic,
    ChangeMethodsLogic,
  );

  // Only attempt to get config if we have an account connected
  let config: IConfig | null = null;
  if (account && account.accountId) {
    try {
      // get oracle address from logic contract
      config = await view(
        logicContract,
        ViewMethodsLogic[ViewMethodsLogic.get_config],
      ) as IConfig;
    } catch (error) {
      console.warn("Failed to get config, wallet may not be connected yet:", error);
      // Return a partial burrow object that can be used for connecting
      burrow = {
        selector,
        changeAccount,
        fetchData: fetchDataCached,
        hideModal: hideModalCached,
        signOut: signOutCached,
        signIn,
        account,
        logicContract,
        view,
        call,
      } as any;
      
      return burrow;
    }
  } else {
    // Return a partial burrow object that can be used for connecting
    burrow = {
      selector,
      changeAccount,
      fetchData: fetchDataCached,
      hideModal: hideModalCached,
      signOut: signOutCached,
      signIn,
      account,
      logicContract,
      view,
      call,
    } as any;
    
    return burrow;
  }

  // Only create oracle contract if we have a config
  let oracleContract = null;
  if (config && config.oracle_account_id) {
    oracleContract = await getContract(
      account,
      config.oracle_account_id,
      ViewMethodsOracle,
      ChangeMethodsOracle,
    );
  }

  if (localStorage.getItem("near-wallet-selector:selectedWalletId") == null) {
    if (
      localStorage.getItem("near_app_wallet_auth_key") != null ||
      localStorage.getItem("null_wallet_auth_key") != null
    ) {
      if (signOutCached) signOutCached();
    }
  }

  burrow = {
    selector,
    changeAccount,
    fetchData: fetchDataCached,
    hideModal: hideModalCached,
    signOut: signOutCached,
    signIn,
    account,
    logicContract,
    oracleContract,
    view,
    call,
    config,
  } as IBurrow;

  return burrow;
};

// Initialize contract & set global variables
export async function initContract(): Promise<IBurrow> {
  return getBurrow();
}

export function accountTrim(accountId: string) {
  return accountId && accountId.length > 14 + 14 + 1
    ? `${accountId.slice(0, 6)}...${accountId.slice(-6)}`
    : accountId;
}

export const getLocalAppVersion = () => {
  return process.env.CONFIG_BUILD_ID;
};

export const getRemoteAppVersion = async () => {
  const res = await fetch(window.location.origin);
  const html = await res.text();
  const parser = new DOMParser();
  const htmlDoc = parser.parseFromString(html, "text/html");
  const data = JSON.parse(htmlDoc.querySelector("#__NEXT_DATA__")?.textContent as string);
  return data.buildId;
};

export function decimalMax(a: string | number | Decimal, b: string | number | Decimal): Decimal {
  a = new Decimal(a);
  b = new Decimal(b);
  return a.gt(b) ? a : b;
}

export function decimalMin(a: string | number | Decimal, b: string | number | Decimal): Decimal {
  a = new Decimal(a);
  b = new Decimal(b);
  return a.lt(b) ? a : b;
}
export function standardizeAsset(asset) {
  if (asset.symbol === "wNEAR") {
    asset.symbol = nearMetadata.symbol;
    asset.icon = nearMetadata.icon;
  }
  if (asset.symbol === "WOO") {
    asset.icon = wooMetadata.icon;
  }
  if (asset.symbol === "sFRAX") {
    asset.icon = sfraxMetadata.icon;
  }
  if (asset.symbol === "FRAX") {
    asset.icon = fraxMetadata.icon;
  }
  return asset;
}
