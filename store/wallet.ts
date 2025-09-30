import { Contract } from "near-api-js";
import BN from "bn.js";
import { Transaction as SelectorTransaction } from "@near-wallet-selector/core";

import { getBurrow } from "../utils";
import { ViewMethodsLogic } from "../interfaces/contract-methods";
import { Balance } from "../interfaces";
import getConfig from "../utils/config";

// Lazy load to avoid calling getConfig at module load time
const getSpecialRegistrationTokenIds = () => {
  const { SPECIAL_REGISTRATION_TOKEN_IDS } = getConfig() as any;
  return SPECIAL_REGISTRATION_TOKEN_IDS;
};

// Cache for isRegistered to reduce excessive RPC calls
const registrationCache = new Map<string, { result: boolean; timestamp: number }>();
const REGISTRATION_CACHE_DURATION = 60000; // 1 minute

export interface Transaction {
  receiverId: string;
  functionCalls: FunctionCallOptions[];
}

export interface FunctionCallOptions {
  methodName: string;
  args?: Record<string, unknown>;
  gas?: BN;
  attachedDeposit?: BN;
}

export const executeMultipleTransactions = async (transactions) => {
  console.log('aloha executeMultipleTransactions called with:', transactions);
  
  const { account, selector, hideModal, signOut, fetchData } = await getBurrow();
  console.log('aloha got burrow, account:', account?.accountId);

  const selectorTransactions: Array<SelectorTransaction> = transactions.map((t) => ({
    signerId: account.accountId,
    receiverId: t.receiverId,
    actions: t.functionCalls.map(
      ({ methodName, args = {}, gas = "100000000000000", attachedDeposit = "1" }) => ({
        type: "FunctionCall",
        params: {
          methodName,
          args,
          gas: gas.toString(),
          deposit: attachedDeposit.toString(),
        },
      }),
    ),
  }));

  console.log('aloha prepared selector transactions:', selectorTransactions);

  try {
    console.log('aloha getting wallet from selector...');
    const wallet = await selector.wallet();
    console.log('aloha got wallet:', wallet?.id);
    
    localStorage.setItem('pendingAction', 'Transaction');
    localStorage.setItem('pendingTransactionTime', Date.now().toString());
    
    console.log('aloha about to call signAndSendTransactions...');
    const result: any = await wallet.signAndSendTransactions({
      transactions: selectorTransactions,
    });
    console.log('aloha signAndSendTransactions completed with result:', result);
    
    if (result) {
      const txHash = Array.isArray(result) 
        ? result[0]?.transaction_outcome?.id
        : (result.transactionHashes?.[0] || result.transaction?.hash);
      
      if (txHash) {
        localStorage.setItem('lastTransactionHash', txHash);
        localStorage.setItem('lastTransactionTime', Date.now().toString());
      }
    }
    
    if (fetchData) fetchData(account.accountId);
    
    return result;
  } catch (e: any) {
    if (/reject/.test(e)) {
      alert("Transaction was rejected in wallet. Please try again!");
      hideModal();
      return null;
    }
    if (!/No accounts available/.test(e)) {
      throw e;
    }
    console.warn(e);
    signOut();
    alert(
      "No accounts available. Your wallet may be locked. You have been signed out. Please sign in again!",
    );
    return null;
  } finally {
    if (hideModal) hideModal();
  }
};

export const getLastTransactionHash = () => {
  const hash = localStorage.getItem('lastTransactionHash');
  const time = parseInt(localStorage.getItem('lastTransactionTime') || '0');
  
  if (hash && time && Date.now() - time < 30000) {
    return hash;
  }
  return undefined;
};

export const isRegistered = async (account_id: string, contract: Contract): Promise<boolean> => {
  // Check cache first
  const cacheKey = `${account_id}:${contract.contractId}`;
  const cached = registrationCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < REGISTRATION_CACHE_DURATION) {
    return cached.result;
  }

  const { view } = await getBurrow();
  let result: boolean;
  
  if (getSpecialRegistrationTokenIds().includes(contract.contractId)) {
    try {
      const balance = (await view(contract, ViewMethodsLogic[ViewMethodsLogic.storage_balance_of], {
        account_id,
      })) as Balance;
      result = balance && balance?.total !== "0";
    } catch (error) {
      const registration = (await view(
        contract,
        ViewMethodsLogic[ViewMethodsLogic.check_registration],
        {
          account_id,
        },
      )) as boolean;
      result = registration;
    }
  } else {
    const balance = (await view(contract, ViewMethodsLogic[ViewMethodsLogic.storage_balance_of], {
      account_id,
    })) as Balance;
    result = balance && balance?.total !== "0";
  }
  
  // Cache the result
  registrationCache.set(cacheKey, { result, timestamp: now });
  return result;
};
export const isRegisteredNew = async (account_id: string, contract: Contract): Promise<boolean> => {
  const { view } = await getBurrow();
  try {
    (await view(contract, ViewMethodsLogic[ViewMethodsLogic.storage_balance_of], {
      account_id,
    })) as Balance;
    return true;
  } catch (error) {
    return false;
  }
};
