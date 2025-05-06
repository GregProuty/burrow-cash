import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { ContentBox } from "../ContentBox/ContentBox";
import { useAccountId } from "../../hooks/hooks";
import * as nearAPI from 'near-api-js';
import { 
  fetchNearTransactions, 
  getCachedTransactions, 
  checkAndCacheCurrentTransaction,
  cacheTransaction
} from "./near-transaction.service";
import CustomButton from "../CustomButton/CustomButton";

// Define locally to fix import error
interface StakingOperation {
  id: string;
  timestamp: number;
  operation: 'stake' | 'unstake' | 'withdraw';
  amount: string;
  txHash: string;
  status: 'success' | 'pending' | 'failed';
}

interface TransactionHistoryProps {
  validatorAddress: string;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ validatorAddress }) => {
  const accountId = useAccountId();
  const [transactions, setTransactions] = useState<StakingOperation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    console.log("TransactionHistory mounted with:", { accountId, validatorAddress });
    
    if (accountId) {
      // Check if there's a transaction in the URL or localStorage that needs to be added
      const currentTx = checkAndCacheCurrentTransaction(accountId, validatorAddress);
      console.log("Current transaction from URL/localStorage:", currentTx);
      
      // Merge with cached transactions
      const cachedTxs = getCachedTransactions();
      console.log("Cached transactions:", cachedTxs);
      
      // Set initial transactions from cache
      if (cachedTxs.length > 0) {
        console.log("Setting transactions from cache");
        setTransactions(cachedTxs);
      }
      
      // Then fetch from the network
      fetchTransactionHistory();
    }
  }, [accountId, validatorAddress]);

  const fetchTransactionHistory = async () => {
    if (!accountId) return;
    
    try {
      console.log("Fetching transaction history for:", { accountId, validatorAddress });
      setIsLoading(true);
      
      // Fetch transactions from the NEAR Explorer API
      const fetchedTransactions = await fetchNearTransactions(accountId, validatorAddress, 20);
      console.log("Fetched transactions:", fetchedTransactions);
      setInitialLoad(false);
      
      // If we got transactions, update the state
      if (fetchedTransactions.length > 0) {
        console.log("Setting fetched transactions:", fetchedTransactions);
        setTransactions(fetchedTransactions);
        setHasMore(fetchedTransactions.length >= 20);
      } else if (transactions.length === 0) {
        // If we didn't get any transactions, but need to show something
        // Create a placeholder transaction for the first stake/unstake/withdraw
        if (initialLoad) {
          console.log("No transactions found, creating placeholder for first transaction");
          // We'll only show this if the user hasn't done any transactions yet
          setTransactions([]);
        }
      }
    } catch (error) {
      console.error("Error fetching transaction history:", error);
      setInitialLoad(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = () => {
    // Implement pagination when needed
    setPage(prev => prev + 1);
    fetchTransactionHistory();
  };

  const handleViewTransaction = (txHash: string) => {
    window.open(`https://nearblocks.io/txns/${txHash}`, '_blank');
  };

  const clearHistory = () => {
    console.log("Clearing transaction history");
    localStorage.removeItem('recentStakingTransactions');
    setTransactions([]);
  };

  // Add a manual transaction for testing
  const addTestTransaction = () => {
    const testTx: StakingOperation = {
      id: `manual-test-${Date.now()}`,
      txHash: '3JBVzjAJxqyxu2bSG7HKuKih3ydz5yo3rY5Fh8NDi4Zt',
      operation: 'stake',
      amount: '1.0',
      timestamp: Date.now(),
      status: 'success'
    };
    cacheTransaction(testTx);
    setTransactions([testTx, ...transactions]);
  };

  return (
    <ContentBox className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Transaction History</h3>
        <div className="flex gap-4">
          <CustomButton 
            onClick={fetchTransactionHistory} 
            className="px-4 py-2"
            color="info"
            isLoading={isLoading}
          >
            Refresh
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
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{new Date(tx.timestamp).toLocaleString()}</td>
                  <td>
                    <OperationBadge type={tx.operation}>
                      {tx.operation.charAt(0).toUpperCase() + tx.operation.slice(1)}
                    </OperationBadge>
                  </td>
                  <td>{tx.amount} NEAR</td>
                  <td>
                    <StatusBadge status={tx.status}>
                      {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                    </StatusBadge>
                  </td>
                  <td>
                    <ViewButton onClick={() => handleViewTransaction(tx.txHash)}>
                      View
                    </ViewButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </StyledTable>
          
          {hasMore && (
            <div className="flex justify-center mt-4">
              <CustomButton 
                onClick={handleLoadMore} 
                className="w-1/3"
                color="info"
                isLoading={isLoading}
              >
                Load More
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
    text-align: left;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  th {
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
  }
  
  td {
    font-weight: 400;
  }
  
  tbody tr:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
`;

const OperationBadge = styled.span<{ type: string }>`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: ${props => {
    switch (props.type) {
      case 'stake': return 'rgba(56, 142, 60, 0.2)';
      case 'unstake': return 'rgba(244, 67, 54, 0.2)';
      case 'withdraw': return 'rgba(33, 150, 243, 0.2)';
      default: return 'rgba(255, 255, 255, 0.1)';
    }
  }};
  color: ${props => {
    switch (props.type) {
      case 'stake': return '#4caf50';
      case 'unstake': return '#f44336';
      case 'withdraw': return '#2196f3';
      default: return '#ffffff';
    }
  }};
`;

const StatusBadge = styled.span<{ status: string }>`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: ${props => 
    props.status === 'success' ? 'rgba(76, 175, 80, 0.2)' : 
    props.status === 'failed' ? 'rgba(244, 67, 54, 0.2)' : 
    'rgba(255, 152, 0, 0.2)'
  };
  color: ${props => 
    props.status === 'success' ? '#4caf50' : 
    props.status === 'failed' ? '#f44336' : 
    '#ff9800'
  };
`;

const ViewButton = styled.button`
  background-color: rgba(33, 150, 243, 0.1);
  color: #2196f3;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: rgba(33, 150, 243, 0.2);
  }
`;

export default TransactionHistory; 