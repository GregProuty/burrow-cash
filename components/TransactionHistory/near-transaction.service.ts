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

// Remove hardcoded API key and use environment variable
const NEAR_BLOCKS_API_KEY = process.env.NEXT_PUBLIC_NEAR_BLOCKS_API_KEY;

// Add error if API key is missing
if (!NEAR_BLOCKS_API_KEY) {
  console.error('NEAR Blocks API key is missing. Please add NEXT_PUBLIC_NEAR_BLOCKS_API_KEY to your .env file');
}

// Update rate limiting constants
const RATE_LIMIT_DELAY = 2000; // 2 seconds between requests
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000]; // Longer exponential backoff delays
const COOLDOWN_PERIOD = 5000; // 5 second cooldown after a 429

// Add request throttling
let lastRequestTime = 0;
let last429Time = 0;

/**
 * Helper function to handle rate limiting
 */
async function makeRateLimitedRequest(url: string, options: RequestInit): Promise<Response> {
  // Check if we're in cooldown period after a 429
  const now = Date.now();
  const timeSinceLast429 = now - last429Time;
  if (timeSinceLast429 < COOLDOWN_PERIOD) {
    const waitTime = COOLDOWN_PERIOD - timeSinceLast429;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  // Ensure minimum time between requests
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  
  // Try the request with retries
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If we get a 429, wait and retry
      if (response.status === 429) {
        last429Time = Date.now();
        const retryDelay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      return response;
    } catch (error) {
      if (attempt === MAX_RETRIES - 1) throw error;
      const retryDelay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  throw new Error('Max retries exceeded');
}

/**
 * Helper to identify operation type from transaction logs
 */
function identifyOperationFromLogs(logs: string[]): 'stake' | 'unstake' | 'withdraw' | null {
  if (!logs || !Array.isArray(logs) || logs.length === 0) return null;
  
  for (const log of logs) {
    const logLower = log.toLowerCase();
    
    // Only match exact staking-related keywords
    if (logLower.includes('stake') && !logLower.includes('unstake')) {
      return 'stake';
    } 
    else if (logLower.includes('unstake')) {
      return 'unstake';
    } 
    else if (logLower.includes('withdraw')) {
      return 'withdraw';
    }
  }
  
  return null;
}

/**
 * Identify operation type from transaction method and logs
 */
export function identifyOperationType(
  methodName: string | null, 
  logs: string[] = [], 
  action: string | null = null
): 'stake' | 'unstake' | 'withdraw' | null {
  // First try to identify from method name
  if (methodName && METHOD_TO_OPERATION[methodName]) {
    return METHOD_TO_OPERATION[methodName];
  }
  
  // Then try to identify from logs
  const logBasedType = identifyOperationFromLogs(logs);
  if (logBasedType) {
    return logBasedType;
  }
  
  // Finally, fallback to action string if provided
  if (action) {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('unstake')) {
      return 'unstake';
    } else if (actionLower.includes('withdraw')) {
      return 'withdraw';
    } else if (actionLower.includes('stake')) {
      return 'stake';
    }
  }
  
  // Return null for any other type of transaction
  return null;
}

/**
 * Fetches transactions for a specific account from NEAR Lake Indexer
 * @param onProgress Optional callback to track progress
 */
export async function fetchNearTransactions(
  accountId: string, 
  validatorAddress: string, 
  limit = 20,
  onProgress?: (current: number, total: number) => void
): Promise<StakingOperation[]> {
  try {
    // Get cached transactions for immediate display
    const cached = getCachedTransactions();
    
    // Continue fetching from network regardless of cache state
    
    // Get validator domain for flexible matching
    const validatorDomain = validatorAddress.split('.')[0];
    
    // Try CORS-friendly approach first - using public NEAR Explorer's API
    const explorerUrl = `https://api.nearblocks.io/v1/account/${accountId}/txns?limit=${limit}`;
    
    let transactions: any[] = [];
    
    try {
      // Try NEAR Explorer API first as it's more CORS-friendly
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const explorerResponse = await makeRateLimitedRequest(explorerUrl, {
          signal: controller.signal,
          mode: 'cors',
          headers: {
            'Accept': 'application/json',
            'x-api-key': NEAR_BLOCKS_API_KEY,
            'Content-Type': 'application/json'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (explorerResponse.ok) {
          const data = await explorerResponse.json();
          
          if (data && data.txns && Array.isArray(data.txns)) {
            transactions = data.txns;
          }
        }
      } catch (fetchError) {
        // Don't rethrow, continue with empty transactions
      }
    } catch (error) {
      // Continue with empty transactions
    }
    
    // Try to use imported data if available
    if (transactions.length === 0) {
      try {
        const rawData = localStorage.getItem('importedTransactionData');
        if (rawData) {
          transactions = JSON.parse(rawData);
        }
      } catch (error) {
        console.error("Error parsing imported transaction data:", error);
      }
    }
    
    if (transactions.length === 0) {
      return cached;
    }
    
    // Process the transactions to find staking operations
    const operations: StakingOperation[] = [];
    
    // Process all transactions
    const total = transactions.length;
    let processedCount = 0;
    
    // Track transactions by their hash to group related operations
    const txHashGroups: { [key: string]: any[] } = {};
    
    // First group transactions by hash to process them together
    for (const tx of transactions) {
      const txHash = tx.transaction_hash || tx.hash;
      if (!txHashGroups[txHash]) {
        txHashGroups[txHash] = [];
      }
      txHashGroups[txHash].push(tx);
    }
    
    for (const [txHash, txGroup] of Object.entries(txHashGroups)) {
      // Update progress if callback provided
      if (onProgress) {
        onProgress(processedCount + 1, total);
      }
      
      processedCount++;
      
      try {
        // Find the main action transaction (usually to the pool)
        let mainActionTx = null;
        let functionCallTx = null;
        
        // First, find function call transactions
        for (const tx of txGroup) {
          // Skip non-validator related transactions
          const receiverId = tx.receiver_account_id || tx.receiver_id;
          if (!receiverId) continue;
          
          const isPoolTx = 
            receiverId === validatorAddress || 
            receiverId.includes('pool') || 
            receiverId.includes('stake');
          
          if (isPoolTx && tx.actions && Array.isArray(tx.actions)) {
            for (const action of tx.actions) {
              if (action.action === "FUNCTION_CALL" && action.method) {
                functionCallTx = tx;
                break;
              }
            }
          }
          
          if (functionCallTx) break;
        }
        
        mainActionTx = functionCallTx || txGroup[0];
        
        if (!mainActionTx) continue;
        
        const blockTimestamp = mainActionTx.block_timestamp || 
          (mainActionTx.receipt_block && mainActionTx.receipt_block.block_timestamp) || 
          Date.now();
        
        // First determine the operation type
        let operationType: 'stake' | 'unstake' | 'withdraw' = 'stake'; // Default
        let amount = '0';
        let logs: string[] = [];
        
        // Extract logs from the transaction if available
        if (mainActionTx.outcomes && mainActionTx.outcomes.logs && Array.isArray(mainActionTx.outcomes.logs)) {
          logs = mainActionTx.outcomes.logs;
        }
        
        // Process function calls first (unstake, withdraw)
        let methodName = null;
        if (functionCallTx && functionCallTx.actions) {
          for (const action of functionCallTx.actions) {
            if (action.action === "FUNCTION_CALL") {
              // Get method name for operation type determination
              methodName = action.method;
              
              // Extract amount from args if available
              if (action.args && typeof action.args === 'string') {
                try {
                  const parsedArgs = JSON.parse(action.args);
                  if (parsedArgs && parsedArgs.amount) {
                    amount = parsedArgs.amount;
                  }
                } catch (e) {
                  // JSON parse error
                }
              }
            }
          }
        }
        
        // Determine operation type based on method name and logs
        operationType = identifyOperationType(methodName, logs);
        
        // If no amount found in function call, look for deposit in the transaction group
        if (amount === '0') {
          // For stake operations, find the largest deposit
          let maxDeposit = 0;
          
          for (const tx of txGroup) {
            if (tx.actions && Array.isArray(tx.actions)) {
              for (const action of tx.actions) {
                if (action.deposit && typeof action.deposit === 'number' && action.deposit > maxDeposit) {
                  maxDeposit = action.deposit;
                } else if (action.deposit && typeof action.deposit === 'string') {
                  const depositNum = parseFloat(action.deposit);
                  if (!isNaN(depositNum) && depositNum > maxDeposit) {
                    maxDeposit = depositNum;
                  }
                }
              }
            }
          }
          
          if (maxDeposit > 0) {
            amount = maxDeposit.toString();
          }
        }
        
        // Format the amount
        const formattedAmount = formatNearAmount(amount);
        
        // Determine status
        const status = 
          (mainActionTx.outcomes && mainActionTx.outcomes.status === false) ? 
          'failed' : 'success';
        
        // Create the operation record
        const stakingOp: StakingOperation = {
          id: txHash,
          txHash,
          operation: operationType,
          amount: formattedAmount,
          timestamp: typeof blockTimestamp === 'string' ? 
            parseInt(blockTimestamp) / 1000000 : 
            blockTimestamp / 1000000,
          status
        };
        
        operations.push(stakingOp);
      } catch (error) {
        console.error('Error processing transaction', error);
      }
    }
    
    console.log(`Found ${operations.length} staking operations`);
    
    // If we found operations, cache them
    if (operations.length > 0) {      
      // Prioritize newly found operations over cached ones
      for (const op of operations) {
        cacheTransaction(op);
      }
      
      // Return freshly updated transactions
      return getCachedTransactions();
    }
    
    // If no new operations were found from the network, return the cached ones
    return cached;
  } catch (error) {
    console.error('Error fetching transactions from NEAR Indexer', error);
    return getCachedTransactions();
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
      
      // Remove test transaction if it exists
      const filteredTransactions = parsed.filter(tx => !tx.id.startsWith('test-tx'));
      
      return filteredTransactions;
    }
  } catch (error) {
    console.error('Error retrieving cached transactions', error);
  }
  
  return [];
}

/**
 * Caches a transaction in local storage
 */
export function cacheTransaction(operation: StakingOperation): void {
  try {
    // Ignore test transactions for production
    if (operation.id.startsWith('test-tx') && process.env.NODE_ENV === 'production') {
      return;
    }
    
    // Skip null operations or non-staking operations
    if (!operation.operation) {
      return;
    }
    
    // Ensure correct operation type (exactly one of the valid types)
    let validOperation: 'stake' | 'unstake' | 'withdraw';
    
    if (operation.operation === 'unstake') {
      validOperation = 'unstake';
    } else if (operation.operation === 'withdraw') {
      validOperation = 'withdraw';
    } else if (operation.operation === 'stake') {
      validOperation = 'stake';
    } else {
      // Skip any other operation types
      return;
    }
    
    // Create corrected operation object
    const correctedOperation = {
      ...operation,
      operation: validOperation
    };
    
    // Get existing cached transactions
    const existing = getCachedTransactions();
    
    // Check if transaction already exists by hash
    if (existing.some(tx => tx.txHash === correctedOperation.txHash)) {
      return;
    }
    
    // Add new transaction at the beginning
    const updated = [correctedOperation, ...existing.slice(0, 19)]; // Keep max 20 transactions
    
    // Save to localStorage
    localStorage.setItem('recentStakingTransactions', JSON.stringify(updated));
  } catch (error) {
    console.error('Error caching transaction', error);
  }
}

/**
 * Adds the current transaction to the history from URL parameters
 */
export function checkAndCacheCurrentTransaction(accountId: string, validatorAddress: string): StakingOperation | null {
  try {
    // Check URL for transaction hash
    const url = new URL(window.location.href);
    const txHashes = url.searchParams.get("transactionHashes");
    
    if (txHashes) {
      const hash = txHashes.split(',')[0];
      const action = localStorage.getItem('pendingAction') || 'Transaction';
      const amount = localStorage.getItem('pendingAmount') || '0';
      
      // Fetch transaction details from NEAR Explorer API
      const exploreTransaction = async () => {
        try {
          const response = await makeRateLimitedRequest(`https://api.nearblocks.io/v1/txns/${hash}`, {
            headers: {
              'Accept': 'application/json',
              'x-api-key': NEAR_BLOCKS_API_KEY
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data && data.txns && data.txns[0]) {
              const txn = data.txns[0];
              
              // Extract method name and logs if available
              let methodName = null;
              let logs: string[] = [];
              
              // Try to extract method name from actions
              if (txn.actions && Array.isArray(txn.actions)) {
                for (const action of txn.actions) {
                  if (action.action === "FUNCTION_CALL" && action.method) {
                    methodName = action.method;
                    break;
                  }
                }
              }
              
              // Try to extract logs from outcomes
              if (txn.outcomes && txn.outcomes.logs && Array.isArray(txn.outcomes.logs)) {
                logs = txn.outcomes.logs;
              }
              
              // Determine operation type using method and logs
              const operationType = identifyOperationType(methodName, logs, action);
              
              // Format the amount nicely
              let formattedAmount = amount;
              try {
                if (amount && !amount.includes('.') && amount !== '0') {
                  formattedAmount = formatNearAmount(amount);
                }
              } catch (e) {
                console.error('Error formatting amount:', e);
              }
              
              // Create a new operation
              const operation: StakingOperation = {
                id: hash,
                txHash: hash,
                operation: operationType,
                amount: formattedAmount,
                timestamp: Date.now(),
                status: 'success'
              };
              
              // Cache it
              cacheTransaction(operation);
              
              // Clean URL
              window.history.replaceState({}, document.title, window.location.pathname);
              
              return operation;
            }
          }
        } catch (error) {
          console.error('Error fetching transaction details:', error);
        }
        return null;
      };
      
      // Try to explore the transaction, but don't wait for it
      exploreTransaction().catch(console.error);
      
      // Meanwhile, create a basic operation with best guess from action
      let operationType: 'stake' | 'unstake' | 'withdraw' = identifyOperationType(null, [], action);
      
      // Format the amount nicely
      let formattedAmount = amount;
      try {
        if (amount && !amount.includes('.') && amount !== '0') {
          formattedAmount = formatNearAmount(amount);
        }
      } catch (e) {
        console.error('Error formatting amount:', e);
      }
      
      // Create a new operation
      const operation: StakingOperation = {
        id: hash,
        txHash: hash,
        operation: operationType,
        amount: formattedAmount,
        timestamp: Date.now(),
        status: 'success'
      };
      
      // Cache it
      cacheTransaction(operation);
      
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      return operation;
    }
    
    // Check for last transaction hash in localStorage
    const lastTxHash = getLastTransactionHash();
    if (lastTxHash) {
      const action = localStorage.getItem('pendingAction') || 'Transaction';
      const amount = localStorage.getItem('pendingAmount') || '0';
      
      // Determine operation type from action
      let operationType = identifyOperationType(null, [], action);
      
      // Format the amount nicely
      let formattedAmount = amount;
      try {
        // If the amount is in yoctoNEAR (large number or numerical string), format it
        if (amount && !amount.includes('.') && amount !== '0') {
          formattedAmount = formatNearAmount(amount);
        }
      } catch (e) {
        console.error('Error formatting amount:', e);
      }
      
      // Create a new operation
      const operation: StakingOperation = {
        id: lastTxHash,
        txHash: lastTxHash,
        operation: operationType,
        amount: formattedAmount,
        timestamp: Date.now(),
        status: 'success'
      };
      
      // Cache it
      cacheTransaction(operation);
      
      return operation;
    }
    
    return null;
  } catch (error) {
    console.error('Error checking current transaction', error);
    return null;
  }
}

/**
 * Clears all cached transactions from localStorage
 */
export function clearCachedTransactions(): void {
  try {
    console.log('Clearing all cached transactions');
    localStorage.removeItem('recentStakingTransactions');
  } catch (error) {
    console.error('Error clearing cached transactions', error);
  }
}

// Helper to format amounts safely
function formatNearAmount(rawAmount: string | number | undefined): string {
  if (!rawAmount) return '0';
  
  try {
    // Handle scientific notation (common in the API response)
    if (typeof rawAmount === 'number' || 
        (typeof rawAmount === 'string' && rawAmount.includes('e'))) {
      // Convert to a regular number
      const num = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount;
      
      // Convert from yoctoNEAR to NEAR if it's a large number (e+18 and above)
      if (num >= 1e18) {
        // Scientific notation like 3.720409471898203e+21 is in yoctoNEAR
        const nearAmount = num / 1e24;
        
        // Format to max 4 decimal places for readability
        if (nearAmount > 0 && nearAmount < 0.001) {
          return '< 0.001';
        }
        
        // For regular amounts, format properly
        return nearAmount.toFixed(4).replace(/\.?0+$/, '');
      }
      
      // For smaller numbers, just format normally
      return num.toFixed(4).replace(/\.?0+$/, '');
    }
    
    // If it's already a formatted string with decimals, return it
    if (typeof rawAmount === 'string' && rawAmount.includes('.')) {
      const num = parseFloat(rawAmount);
      // If it's a very small amount
      if (num > 0 && num < 0.001) {
        return '< 0.001';
      }
      // Format to max 4 decimal places
      return num.toFixed(4).replace(/\.?0+$/, '');
    }
    
    // Handle yoctoNEAR
    if (typeof rawAmount === 'string' && rawAmount.length > 18) {
      try {
        // Format using NEAR API utils
        const formatted = nearAPI.utils.format.formatNearAmount(rawAmount);
        
        // If amount is very small (less than 0.001), show as "< 0.001"
        if (parseFloat(formatted) > 0 && parseFloat(formatted) < 0.001) {
          return '< 0.001';
        }
        
        // Limit to 4 decimal places for consistency
        const num = parseFloat(formatted);
        return num.toFixed(4).replace(/\.?0+$/, '');
      } catch (e) {
        console.warn('Error formatting with NEAR API:', e);
        // Try manual conversion
        try {
          const parsed = BigInt(rawAmount);
          const nearAmount = Number(parsed) / 1e24;
          if (nearAmount > 0 && nearAmount < 0.001) {
            return '< 0.001';
          }
          return nearAmount.toFixed(4).replace(/\.?0+$/, '');
        } catch (bigIntError) {
          console.warn('Error with BigInt conversion:', bigIntError);
          // Last resort - try direct division
          return (parseFloat(rawAmount) / 1e24).toFixed(4).replace(/\.?0+$/, '');
        }
      }
    }
    
    // For other cases, attempt to format normally
    try {
      const num = parseFloat(rawAmount.toString());
      if (isNaN(num)) return '0';
      if (num > 0 && num < 0.001) return '< 0.001';
      return num.toFixed(4).replace(/\.?0+$/, '');
    } catch (e) {
      console.error('Error during number formatting:', e);
      return '0';
    }
  } catch (error) {
    console.error('Error formatting NEAR amount:', error);
    return '0';
  }
}

// Add a method for debugging/importing transaction data
export function importTransactionData(data: any[]): void {
  try {
    // Store the raw data for processing
    localStorage.setItem('importedTransactionData', JSON.stringify(data));
    console.log(`Imported ${data.length} transactions for debugging`);
  } catch (error) {
    console.error('Error importing transaction data', error);
  }
} 