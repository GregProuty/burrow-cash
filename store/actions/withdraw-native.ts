// this file originally copied from `stake.ts` from the same folder

import { getBurrow } from "../../utils";
import { ChangeMethodsLogic } from "../../interfaces";
import { Transaction } from "../wallet";
import { prepareAndExecuteTransactions } from "../tokens";
import * as nearAPI from 'near-api-js'

export async function withdrawNative({ amount, validatorAddress }: { amount: string; validatorAddress: string }) {
  console.log('aloha withdraw. amount', amount)
  console.log('aloha withdraw. validatorAddress', validatorAddress)
  // const { logicContract } = await getBurrow();

  const withYoctos = nearAPI.utils.format.parseNearAmount(amount)?.toString() as string
  const transactions: Transaction[] = [];

  transactions.push({
    receiverId: validatorAddress,
    functionCalls: [
      {
        // methodName: ChangeMethodsLogic[ChangeMethodsLogic.account_unstake_booster],
        methodName: 'withdraw',
        args: {
          receiver_id: validatorAddress,
          amount: withYoctos,
        },
      },
    ],
  });

  console.log('withdraw transactions', transactions)

  await prepareAndExecuteTransactions(transactions);
}
