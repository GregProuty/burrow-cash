// this file originally copied from `stake.ts` from the same folder

import { getBurrow } from "../../utils";
import { ChangeMethodsLogic } from "../../interfaces";
import { Transaction } from "../wallet";
import { prepareAndExecuteTransactions } from "../tokens";
import * as nearAPI from 'near-api-js'

export async function unstakeNative({ amount, validatorAddress }: { amount: string; validatorAddress: string }) {
  console.log('aloha our new unstake')
  // const { logicContract } = await getBurrow();

  const withYoctos = nearAPI.utils.format.parseNearAmount(amount)?.toString() as string


  const transactions: Transaction[] = [];

  transactions.push({
    receiverId: validatorAddress,
    functionCalls: [
      {
        // methodName: ChangeMethodsLogic[ChangeMethodsLogic.account_unstake_booster],
        methodName: 'unstake',
        args: {
          receiver_id: validatorAddress,
          amount: withYoctos,
        },
      },
    ],
  });

  console.log('aloha transactions', transactions)

  await prepareAndExecuteTransactions(transactions);
}
