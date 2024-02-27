// this file originally copied from `stake.ts` from the same folder

import { getBurrow } from "../../utils";
import { ChangeMethodsLogic } from "../../interfaces";
import { Transaction } from "../wallet";
import { prepareAndExecuteTransactions } from "../tokens";
import * as nearAPI from 'near-api-js'
import BN from "bn.js";

export async function unstakeNative({ amount, validatorAddress }: { amount: string; validatorAddress: string }) {
  console.log('aloha our new unstake. amount', amount)
  console.log('aloha our new unstake. validatorAddress', validatorAddress)
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
        attachedDeposit: new BN(0)
      },

    ],
  });

  console.log('unstake transactions', transactions)

  await prepareAndExecuteTransactions(transactions);
}
