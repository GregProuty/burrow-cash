export interface StakingOperation {
  id: string;
  timestamp: number;
  operation: 'stake' | 'unstake' | 'withdraw';
  amount: string;
  txHash: string;
  status: 'success' | 'pending' | 'failed';
}

export interface NearTransaction {
  hash: string;
  signer_id: string;
  receiver_id: string;
  block_timestamp: number;
  actions: NearAction[];
  status: 'SUCCESS' | 'FAILURE';
}

export interface NearAction {
  action_kind: string;
  args: {
    method_name?: string;
    args_base64?: string;
    deposit?: string;
    gas?: string;
  };
}

export interface TransactionHistoryFilters {
  validatorAddress: string;
  limit?: number;
  before?: string;
} 