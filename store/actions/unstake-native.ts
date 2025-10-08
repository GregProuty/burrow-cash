// this file originally copied from `stake.ts` from the same folder

import { getBurrow } from "../../utils";
import { ChangeMethodsLogic } from "../../interfaces";
import { Transaction } from "../wallet";
import { prepareAndExecuteTransactions } from "../tokens";
import * as nearAPI from 'near-api-js'
import BN from "bn.js";
import { executeMultipleTransactions, getLastTransactionHash } from "../wallet";

export async function unstakeNative({ amount, validatorAddress }: { amount: string; validatorAddress: string }) {
  
  // First, check if we have an active wallet connection
  const { account } = await getBurrow();
  
  if (!account || !account.accountId) {
    console.error('Cannot unstake: no connected wallet');
    throw new Error('Please connect your wallet to unstake');
  }
  
  const withYoctos = nearAPI.utils.format.parseNearAmount(amount)?.toString() as string
  if (!withYoctos) {
    throw new Error('Invalid amount');
  }
  
  const transactions = [{
    receiverId: validatorAddress,
    functionCalls: [
      {
        methodName: 'unstake',
        args: {
          receiver_id: validatorAddress,
          amount: withYoctos,
        },
        attachedDeposit: new BN(0)
      },
    ],
  }];

  console.log('unstake transactions', transactions)

  // Store the action type
  localStorage.setItem('pendingAction', 'Unstake');
  
  // Use executeMultipleTransactions instead of prepareAndExecuteTransactions
  const result = await executeMultipleTransactions(transactions);
  
  // If no result with hash, try to get the most recent transaction hash
  if (!result || !(Array.isArray(result) ? result[0]?.transaction_outcome?.id : (result.transactionHashes || result.transaction?.hash))) {
    const lastHash = getLastTransactionHash();
    if (lastHash) {
      // Create a result object if we found a hash in localStorage
      return { transaction: { hash: lastHash } };
    }
  }
  
  return result;
}
