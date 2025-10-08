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
  
  try {
    const { account, selector, hideModal, signOut, fetchData } = await getBurrow();

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


    try {
      const wallet = await selector.wallet();
      
      // Check if wallet is actually connected
      const accounts = await wallet.getAccounts();
      
      // Check WalletConnect specific state if it's a WC wallet (likely Fireblocks)
      if (wallet.id === 'wallet-connect') {
        // Try to get additional WC state info
        try {
          const walletState = (wallet as any);
          if (walletState.connector) {
            if (walletState.connector.session) {
            }
          }
          
          // Additional Fireblocks-specific checks
          if (walletState.client) {
          }
        } catch (wcError) {
        }
      }

      localStorage.setItem('pendingAction', 'Transaction');
      localStorage.setItem('pendingTransactionTime', Date.now().toString());


      
      // Adjust timeout based on wallet type - Fireblocks needs more time
      const isFireblocks = wallet.id === 'wallet-connect';
      const timeoutDuration = isFireblocks ? 120000 : 60000; // 2 minutes for Fireblocks, 1 minute for others
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          const walletName = isFireblocks ? 'Fireblocks (via WalletConnect)' : wallet.metadata?.name || 'wallet';
          reject(new Error(`Transaction timed out after ${timeoutDuration/1000} seconds - no response from ${walletName}`));
        }, timeoutDuration);
      });
      
      const transactionPromise = wallet.signAndSendTransactions({
        transactions: selectorTransactions,
      });
      
      
      // Add progress logging with wallet-specific messages
      let progressTimer = setInterval(() => {
        if (isFireblocks) {
        } else {
        }
      }, 5000);
      
      try {
        const result: any = await Promise.race([transactionPromise, timeoutPromise]);
        clearInterval(progressTimer);
        
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
      } catch (error) {
        clearInterval(progressTimer);
        
        // If it's a timeout, provide helpful guidance
        if (error.message.includes('timed out')) {
          if (isFireblocks) {
            console.error('FIREBLOCKS SPECIFIC TROUBLESHOOTING:');
            console.error('1. Open the Fireblocks mobile app and check for pending transaction approvals');
            console.error('2. Ensure you have proper signing permissions for this transaction type');
            console.error('3. Check if your Fireblocks session is still active (may need to re-authenticate)');
            console.error('4. Verify WalletConnect connection is stable');
            console.error('5. Try disconnecting and reconnecting the wallet');
            console.error('6. Contact your Fireblocks admin if transaction policies are blocking the transaction');
          } else {
            console.error('GENERAL WALLET TROUBLESHOOTING:');
            console.error('1. Check if your wallet app is open and responsive');
            console.error('2. Verify wallet connection is active');
            console.error('3. Try disconnecting and reconnecting wallet');
            console.error('4. Check network connectivity');
          }
        }
        
        // Note: Removed alert popup - using console logging instead for timeout guidance
        
        throw error;
      } finally {
        localStorage.removeItem('pendingAction');
        localStorage.removeItem('pendingTransactionTime');
      }
    } catch (e: any) {
      throw e;
    }
  } catch (e: any) {
    if (/reject/.test(e)) {
      console.log("Transaction was rejected in wallet");
      const { hideModal } = await getBurrow();
      if (hideModal) hideModal();
      return null;
    }
    if (!/No accounts available/.test(e)) {
      throw e;
    }
    console.warn(e);
    const { signOut } = await getBurrow();
    if (signOut) signOut();
    console.log("No accounts available. Wallet may be locked. User signed out.");
    return null;
  } finally {
    try {
      const { hideModal } = await getBurrow();
      if (hideModal) hideModal();
    } catch (e) {
      // Ignore errors in cleanup
    }
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
