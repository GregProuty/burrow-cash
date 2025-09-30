import { Contract } from "near-api-js";
import Decimal from "decimal.js";
import BN from "bn.js";

import { getBurrow } from "../utils";
import {
  DEFAULT_PRECISION,
  NEAR_DECIMALS,
  NO_STORAGE_DEPOSIT_CONTRACTS,
  NEAR_STORAGE_DEPOSIT,
  NEAR_STORAGE_DEPOSIT_MIN,
  NEAR_STORAGE_EXTRA_DEPOSIT,
} from "./constants";
import { expandToken, expandTokenDecimal, getContract, shrinkToken } from "./helper";
import {
  ViewMethodsLogic,
  ChangeMethodsLogic,
  ChangeMethodsToken,
  ViewMethodsToken,
  IMetadata,
  Balance,
} from "../interfaces";

import {
  executeMultipleTransactions,
  FunctionCallOptions,
  isRegistered,
  isRegisteredNew,
  Transaction,
} from "./wallet";

import getConfig from "../utils/config";

// Lazy load to avoid calling getConfig at module load time
const getSpecialRegistrationTokenIds = () => {
  const { SPECIAL_REGISTRATION_TOKEN_IDS } = getConfig() as any;
  return SPECIAL_REGISTRATION_TOKEN_IDS;
};

// Cache for getMetadata to reduce excessive RPC calls
const metadataCache = new Map<string, { result: IMetadata; timestamp: number }>();
const METADATA_CACHE_DURATION = 300000; // 5 minutes (metadata rarely changes)

Decimal.set({ precision: DEFAULT_PRECISION });

export const getTokenContract = async (tokenContractAddress: string): Promise<Contract> => {
  try {
    const { account } = await getBurrow();
    if (!account) {
      throw new Error("Account is not initialized or wallet not connected");
    }
    return getContract(account, tokenContractAddress, ViewMethodsToken, ChangeMethodsToken);
  } catch (err: any) {
    console.error(`Failed to get token contract for ${tokenContractAddress}: ${err.message}`);
    throw err;
  }
};

export const getMetadata = async (token_id: string): Promise<IMetadata | undefined> => {
  try {
    // Special case for Aurora to avoid WASM execution errors
    if (token_id === 'aurora') {
      return {
        token_id: 'aurora',
        name: 'Aurora',
        symbol: 'AURORA',
        decimals: 18,
        icon: null,
        reference: null,
        reference_hash: null,
      } as IMetadata;
    }

    // Check cache first
    const cached = metadataCache.get(token_id);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < METADATA_CACHE_DURATION) {
      return cached.result;
    }

    const { view } = await getBurrow();
    if (!view) {
      console.warn("View function is not available - wallet might not be connected");
      return undefined;
    }
    
    const tokenContract: Contract = await getTokenContract(token_id);

    const metadata: IMetadata = (await view(
      tokenContract,
      ViewMethodsToken[ViewMethodsToken.ft_metadata],
    )) as IMetadata;

    metadata.token_id = token_id;
    
    // Cache the result
    metadataCache.set(token_id, { result: metadata, timestamp: now });
    
    return metadata;
  } catch (err: any) {
    console.error(`Failed to get metadata for ${token_id} ${err.message}`);
    return undefined;
  }
};

export const getBalance = async (
  token_id: string,
  accountId: string,
): Promise<number | undefined> => {
  if (!accountId) {
    console.warn("AccountId is undefined, returning 0 balance");
    return 0;
  }

  if (token_id === 'aurora') {
    return 0;
  }

  try {
    const { view } = await getBurrow();
    if (!view) {
      console.warn("View function is not available - wallet might not be connected");
      return 0;
    }

    const tokenContract: Contract = await getTokenContract(token_id);

    const balanceInYocto: string = (await view(
      tokenContract,
      ViewMethodsToken[ViewMethodsToken.ft_balance_of],
      {
        account_id: accountId,
      },
    )) as string;

    const metadata = await getMetadata(token_id);
    if (!metadata || metadata.decimals === undefined || metadata.decimals === null) {
      console.warn(`Missing metadata or decimals for token ${token_id}`);
      return 0;
    }
    
    const balance = shrinkToken(balanceInYocto, metadata.decimals);

    return Number(balance);
  } catch (err: any) {
    console.error(`Failed to get balance for ${accountId} on ${token_id} ${err.message}`);
    return 0;
  }
};

export const getAllMetadata = async (token_ids?: string[]): Promise<IMetadata[]> => {
  try {
    // Return empty array if token_ids is undefined or empty
    if (!token_ids || token_ids.length === 0) {
      return [];
    }
    
    const metadata: IMetadata[] = (
      await Promise.all(token_ids.map((token_id) => getMetadata(token_id)))
    ).filter((m): m is IMetadata => !!m);

    return metadata;
  } catch (err) {
    console.error(err);
    throw new Error("getAllMetadata");
  }
};

export const prepareAndExecuteTokenTransactions = async (
  tokenContract: Contract,
  functionCall?: FunctionCallOptions,
  additionalOperations: Transaction[] = [],
) => {
  const { account } = await getBurrow();
  const transactions: Transaction[] = [];

  const functionCalls: FunctionCallOptions[] = [];

  // check if account is registered in the token contract
  if (
    !(await isRegistered(account.accountId, tokenContract)) &&
    !NO_STORAGE_DEPOSIT_CONTRACTS.includes(tokenContract.contractId)
  ) {
    if (getSpecialRegistrationTokenIds().includes(tokenContract.contractId)) {
      const r = await isRegisteredNew(account.accountId, tokenContract);
      if (r) {
        transactions.push({
          receiverId: tokenContract.contractId,
          functionCalls: [
            {
              methodName: ChangeMethodsToken[ChangeMethodsToken.storage_deposit],
              attachedDeposit: new BN(expandToken(NEAR_STORAGE_DEPOSIT, NEAR_DECIMALS)),
            },
          ],
        });
      } else {
        transactions.push({
          receiverId: tokenContract.contractId,
          functionCalls: [
            {
              methodName: ChangeMethodsToken[ChangeMethodsToken.register_account],
              gas: new BN("10000000000000"),
              args: {
                account_id: account.accountId,
              },
              attachedDeposit: new BN(0),
            },
          ],
        });
      }
    } else {
      functionCalls.push({
        methodName: ChangeMethodsToken[ChangeMethodsToken.storage_deposit],
        attachedDeposit: new BN(expandToken(NEAR_STORAGE_DEPOSIT, NEAR_DECIMALS)),
      });
    }
  }

  if (functionCall) {
    // add the actual transaction to be executed
    functionCalls.push(functionCall);
  }

  transactions.push({
    receiverId: tokenContract.contractId,
    functionCalls,
  });

  transactions.push(...additionalOperations);

  await prepareAndExecuteTransactions(transactions);
};

export const prepareAndExecuteTransactions = async (operations: Transaction[] = []) => {
  const { account, logicContract, view } = await getBurrow();
  
  // Check if account or logicContract is null/undefined
  if (!account || !logicContract) {
    console.error('Cannot execute transactions: account or logicContract is not available');
    throw new Error('Please connect your wallet to perform this action');
  }
  
  const transactions: Transaction[] = [];

  const storageDepositTransaction = (deposit: number) => ({
    receiverId: logicContract.contractId,
    functionCalls: [
      {
        methodName: ChangeMethodsLogic[ChangeMethodsLogic.storage_deposit],
        attachedDeposit: new BN(expandToken(deposit, NEAR_DECIMALS)),
      },
    ],
  });

  // check if account is registered in burrow cash
  if (!(await isRegistered(account.accountId, logicContract))) {
    transactions.push(storageDepositTransaction(NEAR_STORAGE_DEPOSIT));
  } else {
    const balance = (await view(
      logicContract,
      ViewMethodsLogic[ViewMethodsLogic.storage_balance_of],
      {
        account_id: account.accountId,
      },
    )) as Balance;

    const balanceAvailableDecimal = new Decimal(balance.available);
    const nearStorageDepositMin = expandTokenDecimal(NEAR_STORAGE_DEPOSIT_MIN, NEAR_DECIMALS);

    if (balanceAvailableDecimal.lessThan(nearStorageDepositMin)) {
      transactions.push(storageDepositTransaction(NEAR_STORAGE_EXTRA_DEPOSIT));
    }
  }

  transactions.push(...operations);
  await executeMultipleTransactions(transactions);
};
