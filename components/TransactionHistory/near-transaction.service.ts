import * as nearAPI from 'near-api-js';
import { NearTransaction, StakingOperation } from './types';
import { getLastTransactionHash } from '../../store/wallet';

// Expand the mapping of method names to operation types
const METHOD_TO_OPERATION: Record<string, 'stake' | 'unstake' | 'withdraw'> = {
  'deposit_and_stake': 'stake',
  'stake': 'stake',
  'deposit': 'stake', // Some pools use deposit
  'unstake': 'unstake',
  'unstake_all': 'unstake',
  'withdraw': 'withdraw',
  'withdraw_all': 'withdraw',
  // Add some potential method variations
  'deposit_to_pool': 'stake',
  'stake_tokens': 'stake',
  'stake_near': 'stake',
  'unstake_tokens': 'unstake',
  'unstake_near': 'unstake',
  'withdraw_tokens': 'withdraw',
  'withdraw_near': 'withdraw',
  'withdraw_from_pool': 'withdraw'
};

/**
 * Fetches transactions for a specific account from NEAR Lake Indexer
 */
export async function fetchNearTransactions(accountId: string, validatorAddress: string, limit = 20): Promise<StakingOperation[]> {
  try {
    console.log(`Fetching transactions for ${accountId} with validator ${validatorAddress}`);
    
    // First try to get transactions from cached localStorage
    const cached = getCachedTransactions();
    if (cached.length > 0) {
      console.log(`Found ${cached.length} cached transactions`);
      return cached; // Return cached transactions first for immediate display
    }
    
    // Use the NEAR Lake Indexer API through Pagoda's API
    // This gives us better filtering capabilities than trying to process all transactions
    const indexerUrl = "https://near-mainnet.api.pagoda.co/index/transactions";
    
    // Prepare the API request to filter transactions:
    // 1. By account ID (either as signer or receiver)
    // 2. By action type (looking for function calls)
    // 3. By pool/validator contract address
    const headers = {
      'Content-Type': 'application/json',
      // Pagoda provides free API keys: https://www.pagoda.co/console
      // If you need to use an API key, uncomment the following line
      // 'x-api-key': 'YOUR_PAGODA_API_KEY'
    };
    
    // Get validator domain for flexible matching
    const validatorDomain = validatorAddress.split('.')[0];
    console.log(`Using validator domain for matching: ${validatorDomain}`);
    
    // First query: transactions TO the validator
    const validatorData = {
      account_id: accountId,
      receiver_id: validatorAddress,
      limit,
      action_type: "FUNCTION_CALL",
      order: "desc"
    };
    
    console.log("Querying indexer for transactions TO validator:", validatorAddress);
    const validatorResponse = await fetch(indexerUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(validatorData)
    });
    
    // Alternative query using NEAR Explorer's existing API for transactions
    const explorerUrl = `https://api.nearblocks.io/v1/account/${accountId}/txns?limit=${limit}`;
    console.log(`Using Explorer API URL as backup: ${explorerUrl}`);
    
    let transactions: any[] = [];
    
    if (validatorResponse.ok) {
      const data = await validatorResponse.json();
      if (data && Array.isArray(data.transactions)) {
        transactions = data.transactions;
        console.log(`Found ${transactions.length} transactions via Pagoda indexer`);
      }
    } else {
      console.log("Indexer API request failed or unavailable, falling back to Explorer API");
      
      // Try NEAR Explorer API as a fallback
      const explorerResponse = await fetch(explorerUrl);
      if (explorerResponse.ok) {
        const data = await explorerResponse.json();
        if (data && Array.isArray(data.txns)) {
          transactions = data.txns;
          console.log(`Found ${transactions.length} transactions via Explorer API`);
        }
      }
    }
    
    if (transactions.length === 0) {
      console.log("No transactions found in any API");
      return cached;
    }
    
    // Process the transactions to find staking operations
    const operations: StakingOperation[] = [];
    
    // Use NEAR RPC for transaction details
    const provider = new nearAPI.providers.JsonRpcProvider({
      url: "https://rpc.mainnet.near.org"
    });
    
    // Process all transactions
    for (const tx of transactions) {
      // Normalize transaction data structure (different between APIs)
      const txHash = tx.hash || tx.transaction_hash;
      const receiverId = tx.receiver_id || tx.receiver_account_id;
      const blockTimestamp = tx.block_timestamp || (tx.block && tx.block.timestamp);
      const signerId = tx.signer_id || tx.signer_account_id;
      
      if (!txHash || !receiverId) {
        console.log("Skipping transaction with missing data");
        continue;
      }
      
      console.log(`Processing transaction: ${txHash} to ${receiverId}`);
      
      // Check if this is related to staking pools
      const isValidatorTx = receiverId === validatorAddress || 
                           receiverId.includes('pool') || 
                           receiverId.includes('stake') ||
                           (validatorDomain && receiverId.includes(validatorDomain));
      
      if (isValidatorTx) {
        console.log(`Found potential validator transaction: ${txHash}`);
        
        try {
          // Get full transaction details from RPC
          const txDetails = await provider.txStatus(txHash, signerId);
          
          if (txDetails && txDetails.transaction && txDetails.transaction.actions) {
            for (const action of txDetails.transaction.actions) {
              if (action.FunctionCall) {
                const methodName = action.FunctionCall.method_name;
                console.log(`Method name: ${methodName}`);
                
                // Check for known staking methods
                if (METHOD_TO_OPERATION[methodName]) {
                  const operation = METHOD_TO_OPERATION[methodName];
                  console.log(`Matched operation ${operation}`);
                  
                  const isSuccess = txDetails.status && 
                                  (txDetails.status.hasOwnProperty('SuccessValue') || 
                                   txDetails.status.hasOwnProperty('SuccessReceiptId'));
                  
                  const stakingOp: StakingOperation = {
                    id: txHash,
                    txHash,
                    operation,
                    amount: nearAPI.utils.format.formatNearAmount(action.FunctionCall.deposit, 2),
                    timestamp: blockTimestamp ? parseInt(blockTimestamp) / 1000000 : Date.now(),
                    status: isSuccess ? 'success' : 'failed'
                  };
                  
                  operations.push(stakingOp);
                  break;
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing transaction', txHash, error);
        }
      }
    }
    
    console.log(`Found ${operations.length} staking operations`);
    
    // If we found operations, cache them
    if (operations.length > 0) {
      // Prioritize newly found operations over cached ones
      for (const op of operations) {
        cacheTransaction(op);
      }
      
      // Return freshly cached transactions
      return getCachedTransactions();
    }
    
    return cached;
  } catch (error) {
    console.error('Error fetching transactions from NEAR Indexer', error);
    
    // Try to use cached data
    const cached = getCachedTransactions();
    return cached;
  }
}

/**
 * Uses local storage to get cached recent transactions
 */
export function getCachedTransactions(): StakingOperation[] {
  try {
    const cachedData = localStorage.getItem('recentStakingTransactions');
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      console.log('Got cached transactions:', parsed);
      
      // Remove test transaction if it exists
      const filteredTransactions = parsed.filter(tx => tx.id !== 'test-tx-1');
      
      return filteredTransactions;
    }
  } catch (error) {
    console.error('Error retrieving cached transactions', error);
  }
  
  console.log('No cached transactions found');
  return [];
}

/**
 * Caches a transaction in local storage
 */
export function cacheTransaction(operation: StakingOperation): void {
  try {
    console.log('Caching transaction:', operation);
    
    // Ignore test transactions
    if (operation.id === 'test-tx-1') {
      console.log('Ignoring test transaction');
      return;
    }
    
    // Get existing cached transactions
    const existing = getCachedTransactions();
    
    // Check if transaction already exists by hash
    if (existing.some(tx => tx.txHash === operation.txHash)) {
      console.log('Transaction already in cache, skipping');
      return;
    }
    
    // Add new transaction at the beginning
    const updated = [operation, ...existing.slice(0, 19)]; // Keep max 20 transactions
    
    // Save to localStorage
    localStorage.setItem('recentStakingTransactions', JSON.stringify(updated));
    console.log('Updated cached transactions:', updated);
  } catch (error) {
    console.error('Error caching transaction', error);
  }
}

/**
 * Adds the current transaction to the history from URL parameters
 */
export function checkAndCacheCurrentTransaction(accountId: string, validatorAddress: string): StakingOperation | null {
  try {
    console.log('Checking for current transaction in URL or localStorage');
    
    // Check URL for transaction hash
    const url = new URL(window.location.href);
    const txHashes = url.searchParams.get("transactionHashes");
    
    if (txHashes) {
      console.log('Found transaction hash in URL:', txHashes);
      const hash = txHashes.split(',')[0];
      const action = localStorage.getItem('pendingAction') || 'Transaction';
      const amount = localStorage.getItem('pendingAmount') || '0';
      
      console.log(`Found pendingAction: ${action}, pendingAmount: ${amount}`);
      
      // Create a new operation
      const operation: StakingOperation = {
        id: hash,
        txHash: hash,
        operation: action.toLowerCase().includes('stake') ? 'stake' :
                  action.toLowerCase().includes('unstake') ? 'unstake' :
                  action.toLowerCase().includes('withdraw') ? 'withdraw' : 'stake',
        amount,
        timestamp: Date.now(),
        status: 'success'
      };
      
      console.log('Created transaction from URL params:', operation);
      
      // Cache it
      cacheTransaction(operation);
      
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      return operation;
    }
    
    // Check for last transaction hash in localStorage
    const lastTxHash = getLastTransactionHash();
    if (lastTxHash) {
      console.log('Found last transaction hash in localStorage:', lastTxHash);
      const action = localStorage.getItem('pendingAction') || 'Transaction';
      const amount = localStorage.getItem('pendingAmount') || '0';
      
      console.log(`Found pendingAction: ${action}, pendingAmount: ${amount}`);
      
      // Create a new operation
      const operation: StakingOperation = {
        id: lastTxHash,
        txHash: lastTxHash,
        operation: action.toLowerCase().includes('stake') ? 'stake' :
                  action.toLowerCase().includes('unstake') ? 'unstake' :
                  action.toLowerCase().includes('withdraw') ? 'withdraw' : 'stake',
        amount,
        timestamp: Date.now(),
        status: 'success'
      };
      
      console.log('Created transaction from localStorage:', operation);
      
      // Cache it
      cacheTransaction(operation);
      
      return operation;
    }
    
    console.log('No current transaction found');
    return null;
  } catch (error) {
    console.error('Error checking current transaction', error);
    return null;
  }
} 