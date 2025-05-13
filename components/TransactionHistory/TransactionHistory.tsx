import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { ContentBox } from "../ContentBox/ContentBox";
import { useAccountId } from "../../hooks/hooks";
import * as nearAPI from 'near-api-js';
import { 
  fetchNearTransactions, 
  getCachedTransactions, 
  clearCachedTransactions,
  checkAndCacheCurrentTransaction,
  cacheTransaction
} from './near-transaction.service';
import CustomButton from "../CustomButton/CustomButton";
import { StakingOperation } from './types';

interface TransactionHistoryProps {
  validatorAddress: string;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ validatorAddress }) => {
  const accountId = useAccountId();
  const [transactions, setTransactions] = useState<StakingOperation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  
  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsPerPage = 10;

  useEffect(() => {
    if (accountId) {
      // Check if there's a transaction in the URL or localStorage that needs to be added
      const currentTx = checkAndCacheCurrentTransaction(accountId, validatorAddress);
      
      // Merge with cached transactions
      const cachedTxs = getCachedTransactions();
      
      // Set initial transactions from cache
      if (cachedTxs.length > 0) {
        setTransactions(cachedTxs);
      }
      
      // Then fetch from the network
      fetchTransactionHistory();
      
      // Set up auto-refresh timer (every 2 minutes)
      const refreshTimer = 120000
      
      // Clean up the timer when unmounting
      return () => {
        clearInterval(refreshTimer);
      };
    }
  }, [accountId, validatorAddress]);

  // Auto-retry on network errors (up to maxRetries)
  useEffect(() => {
    if (fetchError && retryCount < maxRetries) {
      const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
      console.log(`Retrying fetch (${retryCount + 1}/${maxRetries}) in ${retryDelay / 1000}s`);
      
      const retryTimer = setTimeout(() => {
        console.log(`Automatic retry #${retryCount + 1}`);
        setRetryCount(prev => prev + 1);
        fetchTransactionHistory();
      }, retryDelay);
      
      return () => clearTimeout(retryTimer);
    }
  }, [fetchError, retryCount]);

  const fetchTransactionHistory = async () => {
    if (!accountId) return;
    
    try {
      // Clear any previous error state and reset progress
      setFetchError(null);
      setProgress({ current: 0, total: 0 });
      setIsLoading(true);
      
      // First check cached transactions and display them immediately
      const cachedTransactions = getCachedTransactions();
      if (cachedTransactions.length > 0) {
        setTransactions(cachedTransactions);
      }
      
      // Track progress of transaction processing
      const handleProgress = (current: number, total: number) => {
        setProgress({ current, total });
      };
      
      try {
        // Then fetch from the network for fresh data with a timeout
        const fetchPromise = fetchNearTransactions(
          accountId, 
          validatorAddress, 
          20, 
          handleProgress
        );
        
        // Set a timeout to cancel if it takes too long
        const timeoutPromise = new Promise<StakingOperation[]>((_, reject) => {
          setTimeout(() => reject(new Error("Fetch timeout")), 30000); // 30 second timeout
        });
        
        // Race between fetch and timeout
        const fetchedTransactions = await Promise.race([
          fetchPromise,
          timeoutPromise
        ]);
        
        // Reset retry count on success
        setRetryCount(0);
        setInitialLoad(false);
        
        // Update with fresh transactions if any are found
        if (fetchedTransactions.length > 0) {
          setTransactions(fetchedTransactions);
        } else if (transactions.length === 0) {
          // If we have no transactions at all
          setTransactions([]);
        }
      } catch (fetchError) {
        console.error("Network error during fetch:", fetchError);
        
        // Set error message for the user
        if (fetchError.name === 'AbortError' || fetchError.message === 'Fetch timeout') {
          setFetchError("Request timed out. Please try again later.");
        } else if (fetchError.name === 'TypeError' && fetchError.message.includes('Failed to fetch')) {
          setFetchError("Network connection issue. Please check your internet connection.");
        } else {
          setFetchError("Failed to fetch transaction data. Please try again later.");
        }
        
        setInitialLoad(false);
      }
    } catch (error) {
      console.error("Error in transaction history:", error);
      setFetchError("An unexpected error occurred. Please try again later.");
      setInitialLoad(false);
    } finally {
      setIsLoading(false);
      // Reset progress when done
      setProgress({ current: 0, total: 0 });
    }
  };

  // Calculate current transactions to display
  const indexOfLastTransaction = currentPage * transactionsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
  const currentTransactions = transactions.slice(indexOfFirstTransaction, indexOfLastTransaction);
  const totalPages = Math.ceil(transactions.length / transactionsPerPage);

  // Function to change page
  const goToPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // Function to go to next page
  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Function to go to previous page
  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleViewTransaction = (txHash: string) => {
    window.open(`https://nearblocks.io/txns/${txHash}`, '_blank');
  };

  const clearHistory = () => {
    console.log("Clearing transaction history");
    clearCachedTransactions();
    setTransactions([]);
  };

  const addTestTransaction = () => {
    const testOperations: StakingOperation[] = [
      {
        id: 'test-tx-stake',
        amount: '10.5',
        operation: 'stake',
        timestamp: Date.now(),
        txHash: 'test-hash-stake',
        status: 'success'
      },
      {
        id: 'test-tx-unstake',
        amount: '5.25',
        operation: 'unstake',
        timestamp: Date.now() - 1000,
        txHash: 'test-hash-unstake',
        status: 'success'
      },
      {
        id: 'test-tx-withdraw',
        amount: '3.75',
        operation: 'withdraw',
        timestamp: Date.now() - 2000,
        txHash: 'test-hash-withdraw',
        status: 'success'
      },
      {
        id: 'test-tx-small-amount',
        amount: '0.00075',
        operation: 'stake',
        timestamp: Date.now() - 3000,
        txHash: 'test-hash-small',
        status: 'success'
      }
    ];
    
    testOperations.forEach(operation => {
      cacheTransaction(operation);
    });
    
    const updated = getCachedTransactions();
    setTransactions(updated);
  };

  const debugTransactions = () => {
    const cachedTx = getCachedTransactions();
    
    // Count by type
    const counts = {
      stake: 0,
      unstake: 0,
      withdraw: 0,
      unknown: 0
    };
    
    cachedTx.forEach(tx => {
      if (tx.operation === 'stake') counts.stake++;
      else if (tx.operation === 'unstake') counts.unstake++;
      else if (tx.operation === 'withdraw') counts.withdraw++;
      else counts.unknown++;
    });
    
    // Update UI
    setTransactions(cachedTx);
  };

  return (
    <ContentBox className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">
          Transaction History
          {isLoading && transactions.length > 0 && progress.total > 0 && (
            <span className="ml-2 text-sm font-normal text-blue-400">
              (Refreshing... {progress.current}/{progress.total})
            </span>
          )}
          {fetchError && (
            <span className="ml-2 text-sm font-normal text-red-400">
              (Offline Mode)
            </span>
          )}
        </h3>
        <div className="flex gap-4">
          <CustomButton 
            onClick={fetchTransactionHistory} 
            className="px-4 py-2"
            color="info"
            isLoading={isLoading && transactions.length === 0}
          >
            {fetchError ? "Retry" : "Refresh"}
          </CustomButton>
          {transactions.length > 0 ? (
            <CustomButton 
              onClick={clearHistory} 
              className="px-4 py-2"
              color="secondary"
            >
              Clear History
            </CustomButton>
          ) : (
            <CustomButton 
              onClick={addTestTransaction} 
              className="px-4 py-2"
              color="secondary"
            >
              Add Test TX
            </CustomButton>
          )}
        </div>
      </div>
      
      {/* Show error message if fetch failed */}
      {fetchError && (
        <div className="bg-red-900/20 border border-red-900/50 rounded-md p-3 mb-4">
          <p className="text-red-300 text-sm">
            {fetchError} Showing cached transactions only.
          </p>
        </div>
      )}
      
      {isLoading && transactions.length === 0 ? (
        <div className="flex justify-center items-center h-40">Loading transaction history...</div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col justify-center items-center h-40">
          <p className="mb-4">
            {accountId 
              ? "No transaction history found. Stake, unstake or withdraw NEAR to see transactions." 
              : "Please connect your wallet to view transaction history"
            }
          </p>
          {accountId && (
            <p className="text-gray-400 text-sm max-w-md text-center">
              Note: Transactions with validators are shown here. If you've staked with this validator previously but don't see any transactions, try using the Add Test TX button.
            </p>
          )}
        </div>
      ) : (
        <>
          <StyledTable>
            <thead>
              <tr>
                <th>Time</th>
                <th>Operation</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Transaction</th>
              </tr>
            </thead>
            <tbody>
              {currentTransactions.map((tx) => (
                <tr key={tx.id}>
                  <td>
                    {new Date(tx.timestamp).toLocaleString()}
                  </td>
                  <td>
                    <OperationBadge operation={tx.operation} />
                  </td>
                  <td>
                    {tx.amount === '0' 
                      ? '< 0.001' 
                      : tx.amount} NEAR
                  </td>
                  <td>
                    <StatusBadge status={tx.status} />
                  </td>
                  <td>
                    <a
                      href={`https://explorer.near.org/transactions/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#2196f3',
                        textDecoration: 'none',
                      }}
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </StyledTable>
          
          {/* Pagination Controls */}
          {transactions.length > transactionsPerPage && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <CustomButton
                onClick={prevPage}
                disabled={currentPage === 1}
                className="px-3 py-1"
                color="secondary"
              >
                &laquo; Prev
              </CustomButton>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <CustomButton
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`w-8 h-8 p-0 flex items-center justify-center ${
                      currentPage === page 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-800 text-gray-300'
                    }`}
                    color={currentPage === page ? 'info' : 'secondary'}
                  >
                    {page}
                  </CustomButton>
                ))}
              </div>
              
              <CustomButton
                onClick={nextPage}
                disabled={currentPage === totalPages}
                className="px-3 py-1"
                color="secondary"
              >
                Next &raquo;
              </CustomButton>
            </div>
          )}
        </>
      )}
    </ContentBox>
  );
};

const StyledTable = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  color: #fff;
  
  th, td {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  th {
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
    text-align: left;
  }
  
  td {
    font-weight: 400;
  }
  
  tbody tr:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  /* Column-specific styling */
  th:nth-child(1), td:nth-child(1) { /* Time column */
    text-align: left;
    width: 25%;
  }
  
  th:nth-child(2), td:nth-child(2) { /* Operation column */
    text-align: center;
    width: 15%;
  }
  
  th:nth-child(3), td:nth-child(3) { /* Amount column */
    text-align: right;
    width: 20%;
  }
  
  th:nth-child(4), td:nth-child(4) { /* Status column */
    text-align: center;
    width: 15%;
  }
  
  th:nth-child(5), td:nth-child(5) { /* Transaction column */
    text-align: center;
    width: 15%;
  }
`;

interface OperationBadgeProps {
  operation: string;
}

const OperationBadge = ({ operation }: OperationBadgeProps) => {
  // Strictly validate the operation type
  const validOperation = 
    operation === 'unstake' ? 'unstake' :
    operation === 'withdraw' ? 'withdraw' : 
    'stake'; // default

  const getBackgroundColor = () => {
    switch (validOperation) {
      case 'stake':
        return 'rgba(76, 175, 80, 0.3)'; // Green
      case 'unstake':
        return 'rgba(255, 152, 0, 0.3)'; // Orange
      case 'withdraw':
        return 'rgba(33, 150, 243, 0.3)'; // Blue
      default:
        return 'rgba(76, 175, 80, 0.3)'; // Default green
    }
  };

  const getTextColor = () => {
    switch (validOperation) {
      case 'stake':
        return '#388e3c'; // Dark green
      case 'unstake':
        return '#ef6c00'; // Dark orange
      case 'withdraw':
        return '#1565c0'; // Dark blue
      default:
        return '#388e3c'; // Default dark green
    }
  };

  const getLabel = () => {
    switch (validOperation) {
      case 'stake':
        return 'Stake';
      case 'unstake':
        return 'Unstake';
      case 'withdraw':
        return 'Withdraw';
      default:
        return 'Stake';
    }
  };

  return (
    <div
      style={{
        backgroundColor: getBackgroundColor(),
        color: getTextColor(),
        padding: '4px 8px',
        borderRadius: '4px',
        display: 'inline-block',
        fontSize: '0.85rem',
        fontWeight: 600,
        textTransform: 'capitalize',
      }}
    >
      {getLabel()}
    </div>
  );
};

interface StatusBadgeProps {
  status: string;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  // Normalize the status to one of our allowed values
  const normalizedStatus = status === 'failed' ? 'failed' : 'success';
  
  const getBackgroundColor = () => {
    return normalizedStatus === 'success' 
      ? 'rgba(76, 175, 80, 0.2)' // Green for success
      : 'rgba(244, 67, 54, 0.2)'; // Red for failed
  };

  const getTextColor = () => {
    return normalizedStatus === 'success' 
      ? '#388e3c' // Dark green for success
      : '#d32f2f'; // Dark red for failed
  };

  const getLabel = () => {
    return normalizedStatus === 'success' 
      ? 'Success' 
      : 'Failed';
  };

  return (
    <div
      style={{
        backgroundColor: getBackgroundColor(),
        color: getTextColor(),
        padding: '4px 8px',
        borderRadius: '4px',
        display: 'inline-block',
        fontSize: '0.85rem',
        fontWeight: 600,
      }}
    >
      {getLabel()}
    </div>
  );
};

export default TransactionHistory; 