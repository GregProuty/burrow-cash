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
  
  try {
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
      console.log('aloha wallet state:', await selector.store.getState());
      
      // Check if wallet is actually connected
      const accounts = await wallet.getAccounts();
      console.log('aloha wallet accounts:', accounts);
      
      // Check WalletConnect specific state if it's a WC wallet (likely Fireblocks)
      if (wallet.id === 'wallet-connect') {
        console.log('aloha WalletConnect wallet detected (likely Fireblocks)');
        // Try to get additional WC state info
        try {
          const walletState = (wallet as any);
          console.log('aloha WC wallet state keys:', Object.keys(walletState));
          if (walletState.connector) {
            console.log('aloha WC connector connected:', walletState.connector.connected);
            console.log('aloha WC session active:', !!walletState.connector.session);
            if (walletState.connector.session) {
              console.log('aloha WC session peer name:', walletState.connector.session.peer?.metadata?.name);
            }
          }
          
          // Additional Fireblocks-specific checks
          if (walletState.client) {
            console.log('aloha WC client connected:', walletState.client.connected);
          }
        } catch (wcError) {
          console.log('aloha could not get WC state:', wcError);
        }
      }

      localStorage.setItem('pendingAction', 'Transaction');
      localStorage.setItem('pendingTransactionTime', Date.now().toString());

      console.log('aloha about to call signAndSendTransactions...');
      console.log('aloha wallet type:', wallet.id);
      console.log('aloha wallet metadata:', wallet.metadata);
      console.log('aloha transaction details:', JSON.stringify(selectorTransactions, null, 2));

      // === ENHANCED WALLETCONNECT DEBUGGING ===
      if (wallet.id === 'wallet-connect') {
        console.log('🔍 ═══ PRE-TRANSACTION WC COMPREHENSIVE DEBUG ═══');
        
        // CRITICAL: Check what methods the SESSION actually supports
        try {
          const dbRequest = indexedDB.open('WALLET_CONNECT_V2_INDEXED_DB');
          dbRequest.onsuccess = function(event: any) {
            const db = event.target.result;
            const tx = db.transaction(['keyvaluestorage'], 'readonly');
            const store = tx.objectStore('keyvaluestorage');
            
            const sessionRequest = store.get('wc@2:client:0.3:session');
            sessionRequest.onsuccess = function() {
              try {
                const sessions = JSON.parse(sessionRequest.result || '[]');
                if (sessions.length > 0) {
                  const session = sessions[0];
                  const sessionMethods = session.namespaces?.near?.methods || [];
                  console.log('🎯 ═══ CRITICAL: SESSION ALLOWED METHODS ═══');
                  console.log('   Methods in this session:', sessionMethods);
                  console.log('   Has "near_signTransactions"?', sessionMethods.includes('near_signTransactions'));
                  console.log('   Has "near_signAndSendTransactions"?', sessionMethods.includes('near_signAndSendTransactions'));
                  
                  if (!sessionMethods.includes('near_signTransactions')) {
                    console.error('❌ FOUND THE BUG! "near_signTransactions" is NOT in session methods!');
                    console.error('   Rhea will try to call this method and it will be REJECTED.');
                    console.error('   Solution: Clear session and reconnect to get updated methods.');
                  }
                }
              } catch (e) {
                console.warn('Could not parse session for method check');
              }
            };
          };
        } catch (e) {
          console.warn('Could not check session methods');
        }
        
        // Log ALL properties of the wallet object to understand its structure
        const walletState = wallet as any;
        console.log('🔍 WALLET OBJECT KEYS:', Object.keys(walletState));
        console.log('🔍 WALLET OBJECT PROPERTIES:', Object.getOwnPropertyNames(walletState));
        
        // Try to find WalletConnect client/connector in various possible locations
        const possibleConnectorPaths = [
          'connector',
          'client',
          'signClient', 
          'walletConnectClient',
          '_client',
          '_connector',
          '_signClient',
          'connection',
          '_connection'
        ];
        
        console.log('🔍 CHECKING POSSIBLE CONNECTOR LOCATIONS:');
        possibleConnectorPaths.forEach(path => {
          const value = walletState[path];
          if (value) {
            console.log(`  ✅ Found: ${path}`, {
              type: typeof value,
              constructor: value.constructor?.name,
              keys: Object.keys(value).slice(0, 10), // First 10 keys
              hasSession: !!value.session,
              hasConnect: typeof value.connect === 'function',
              hasRequest: typeof value.request === 'function',
            });
          } else {
            console.log(`  ❌ Missing: ${path}`);
          }
        });
        
        // Log the entire wallet state (limited depth to avoid console overflow)
        console.log('🔍 FULL WALLET STATE (shallow):', {
          id: walletState.id,
          type: walletState.type,
          metadata: walletState.metadata,
          // Check for nested objects
          hasConnector: !!walletState.connector,
          hasClient: !!walletState.client,
          hasSignClient: !!walletState.signClient,
          hasConnection: !!walletState.connection,
        });
        
        // Transaction analysis
        console.log('📋 TRANSACTION ANALYSIS:', {
          transactionCount: selectorTransactions.length,
          totalSize: JSON.stringify(selectorTransactions).length + ' bytes',
          transactions: selectorTransactions.map((tx, idx) => ({
            index: idx,
            signerId: tx.signerId,
            receiverId: tx.receiverId,
            actionCount: tx.actions.length,
            actions: tx.actions.map(action => ({
              type: action.type,
              method: action.params?.methodName,
              deposit: action.params?.deposit,
              gas: action.params?.gas,
              argsSize: JSON.stringify(action.params?.args || {}).length + ' bytes'
            }))
          }))
        });
        
        // Check localStorage WC state
        const wcStorageKeys = Object.keys(localStorage).filter(key => 
          key.includes('walletconnect') || key.includes('wc_')
        );
        console.log('💾 WALLETCONNECT LOCALSTORAGE KEYS:', wcStorageKeys);
        
        // Check IndexedDB for pending messages
        try {
          const dbRequest = indexedDB.open('WALLET_CONNECT_V2_INDEXED_DB');
          dbRequest.onsuccess = function(event: any) {
            const db = event.target.result;
            const tx = db.transaction(['keyvaluestorage'], 'readonly');
            const store = tx.objectStore('keyvaluestorage');
            
            const messagesRequest = store.get('wc@2:core:0.3:messages');
            messagesRequest.onsuccess = function() {
              try {
                const messages = JSON.parse(messagesRequest.result || '[]');
                console.log('💬 Pending WC messages before transaction:', messages.length);
              } catch (e) {
                console.log('💬 No pending messages');
              }
            };
          };
        } catch (e) {
          console.warn('Could not check messages');
        }
      }
      // === END ENHANCED WALLETCONNECT DEBUGGING ===
      
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
      
      console.log('aloha waiting for wallet response...');
      
      // Add progress logging with wallet-specific messages
      let progressTimer = setInterval(() => {
        if (isFireblocks) {
          console.log('aloha still waiting for Fireblocks response... (check Fireblocks app for transaction approval)');
        } else {
          console.log('aloha still waiting for wallet response...');
        }
      }, 5000);
      
      try {
        const result: any = await Promise.race([transactionPromise, timeoutPromise]);
        clearInterval(progressTimer);
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
      } catch (error) {
        clearInterval(progressTimer);
        console.error('aloha transaction failed or timed out:', error);
        
        // If it's a timeout, provide helpful guidance
        if (error.message.includes('timed out')) {
          console.error('aloha TIMEOUT GUIDANCE:');
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
      console.error('aloha wallet error:', e);
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
