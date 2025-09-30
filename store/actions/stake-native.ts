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
  console.log('aloha top of stake native. amount', amount);
  console.log('aloha top of stake native. validatorAddress', validatorAddress);

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
  
  console.log('aloha about to execute transactions:', transactions);
  
  try {
    // Execute and get result (might be undefined)
    const result = await executeMultipleTransactions(transactions);
    console.log('aloha transaction result:', result);
    
    // If no result with hash, try to get the most recent transaction hash
    if (!result || !(Array.isArray(result) ? result[0]?.transaction_outcome?.id : (result.transactionHashes || result.transaction?.hash))) {
      const lastHash = getLastTransactionHash();
      if (lastHash) {
        console.log('aloha using cached transaction hash:', lastHash);
        // Create a result object if we found a hash in localStorage
        return { transaction: { hash: lastHash } };
      }
    }
    
    return result;
  } catch (error) {
    console.error('aloha staking failed:', error);
    throw error;
  }
}
