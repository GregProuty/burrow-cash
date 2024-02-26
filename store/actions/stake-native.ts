// this file originally copied from `stake.ts` from the same folder

import { getBurrow } from "../../utils";
import { expandToken } from "../helper";
import { ChangeMethodsLogic } from "../../interfaces";
import { Transaction } from "../wallet";
import { prepareAndExecuteTransactions } from "../tokens";
import * as nearAPI from 'near-api-js'

export async function stakeNative({ amount, validatorAddress }: { amount: string; validatorAddress: string }) {
  console.log('aloha top of stake native. amount', amount)
  console.log('aloha top of stake native. validatorAddress', validatorAddress)

  // const { logicContract, config } = await getBurrow();

  const transactions: Transaction[] = [];

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
  transactions.push({
    receiverId: validatorAddress,
    functionCalls: [
      {
        methodName: ChangeMethodsLogic[ChangeMethodsLogic.account_stake_booster],
        args: {
          receiver_id: validatorAddress,
          // amount: expandToken(amount, config.booster_decimals),
          amount,
        },
      },
    ],
  });

  // await prepareAndExecuteTransactions(transactions);
}
