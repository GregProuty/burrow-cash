// this file originally copied from `stake.ts` from the same folder

import { getBurrow } from "../../utils";
import { expandToken } from "../helper";
import { ChangeMethodsLogic } from "../../interfaces";
import { Transaction } from "../wallet";
import { prepareAndExecuteTransactions } from "../tokens";
import * as nearAPI from 'near-api-js'
import BN from "bn.js";
import { executeMultipleTransactions, getLastTransactionHash } from "../wallet";

export async function stakeNative({ amount, validatorAddress }: { amount: string; validatorAddress: string }) {

  // const { logicContract, config } = await getBurrow();

  // Parse the amount first
  const amountInYocto = nearAPI.utils.format.parseNearAmount(amount);
  
  // Then use it in your transactions
  const transactions = [{
    receiverId: validatorAddress,
    functionCalls: [
      {
        methodName: "deposit_and_stake",
        args: {},
        attachedDeposit: new BN(amountInYocto),
      },
    ],
  }];

  // const duration =
  //   months === 12
  //     ? config.maximum_staking_duration_sec
  //     : months * config.minimum_staking_duration_sec;
  // console.info(
  //   `stake months:${months} duration:${duration}
  //   minSec:${config.minimum_staking_duration_sec},
  //   maxSec:${config.maximum_staking_duration_sec} amount:${amount} decimals:${
  //     config.booster_decimals
  //   } tokenAmount:${expandToken(amount, config.booster_decimals)}`,
  // );

  // Store the action type
  localStorage.setItem('pendingAction', 'Stake');
  
  
  try {
    // Execute and get result (might be undefined)
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
  } catch (error) {
    
    // Check if this is the access key permission error
    if (error?.message?.includes('Fireblocks access key is limited to Burrow contract')) {
      // Re-throw with a more user-friendly message
      throw new Error('Unable to stake: Your Fireblocks wallet is configured with limited permissions that only allow Burrow contract operations. To stake NEAR to validator pools, please contact your Fireblocks administrator to configure a FullAccess key.');
    }
    
    throw error;
  }
}
