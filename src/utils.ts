import {
	connect,
	Contract,
	keyStores,
	WalletConnection,
	ConnectedWalletAccount,
	transactions,
} from "near-api-js";
import getConfig, { LOGIC_CONTRACT_NAME } from "./config";
import {
	ChangeMethodsLogic,
	ChangeMethodsOracle,
	ViewMethodsLogic,
	ViewMethodsOracle,
} from "./interfaces/contract-methods";
import { IBurrow } from "./interfaces/burrow";
import BN from "bn.js";
import { expandToken, getContract } from "./store/helper";
import { NEAR_DECIMALS } from "./store/constants";
import BatchWallet, { BatchWalletAccount, isRegistered } from "./store/wallet";

const nearConfig = getConfig(process.env.DEFAULT_NETWORK || process.env.NODE_ENV || "development");

console.log(`Using network ${nearConfig.networkId}!`);

let burrow: IBurrow;

export const getBurrow = async (): Promise<IBurrow> => {
	if (burrow) return burrow;

	// Initialize connection to the NEAR testnet
	const near = await connect(
		Object.assign(
			{
				deps: { keyStore: new keyStores.BrowserLocalStorageKeyStore() },
			},
			nearConfig,
		),
	);

	// Initializing Wallet based Account. It can work with NEAR testnet wallet that
	// is hosted at https://wallet.testnet.near.org
	const walletConnection = new BatchWallet(near, null);

	// Getting the Account ID. If still unauthorized, it's just empty string
	const account: BatchWalletAccount = new BatchWalletAccount(
		walletConnection,
		near.connection,
		walletConnection.account().accountId,
	);

	if (walletConnection.isSignedIn()) {
		console.log("access keys", await account.getAccessKeys());
	}

	const view = async (
		contract: Contract,
		methodName: string,
		args: Object = {},
		json: boolean = true,
	): Promise<Object | string> => {
		return await account.viewFunction(contract.contractId, methodName, args, {
			// always parse to string, JSON parser will fail if its not a json
			parse: (data: Uint8Array) => {
				const result = Buffer.from(data).toString();
				return json ? JSON.parse(result) : result;
			},
		});
	};

	const call = async (
		contract: Contract,
		methodName: string,
		args: Object = {},
		deposit: string = "1",
	) => {
		const gas = new BN(150000000000000); //new BN(7 * 10 ** 12);
		const attachedDeposit = new BN(deposit);

		console.log(
			"transaction",
			contract.contractId,
			methodName,
			args,
			attachedDeposit.toString(),
			gas.toString(),
		);

		const actions = [
			transactions.functionCall(
				methodName,
				Buffer.from(JSON.stringify(args)),
				gas,
				attachedDeposit,
			),
		];

		if (!(await isRegistered(account.accountId, contract))) {
			actions.splice(
				0,
				0,
				transactions.functionCall(
					ChangeMethodsLogic[ChangeMethodsLogic.storage_deposit],
					{},
					gas,
					// send 0.1 near as deposit to register
					new BN(expandToken(0.1, NEAR_DECIMALS)),
				),
			);
		}

		// @ts-ignore
		return await account.signAndSendTransaction({
			receiverId: contract.contractId,
			actions,
		});
	};

	const logicContract: Contract = await getContract(
		walletConnection.account(),
		LOGIC_CONTRACT_NAME,
		ViewMethodsLogic,
		ChangeMethodsLogic,
	);

	// get oracle address from
	const config = (await view(logicContract, ViewMethodsLogic[ViewMethodsLogic.get_config])) as {
		oracle_account_id: string;
	};

	console.log("oracle address", config.oracle_account_id);

	const oracleContract: Contract = await getContract(
		walletConnection.account(),
		config.oracle_account_id,
		ViewMethodsOracle,
		ChangeMethodsOracle,
	);

	burrow = {
		walletConnection,
		account,
		logicContract,
		oracleContract,
		view,
		call,
	} as IBurrow;

	return burrow;
};

// Initialize contract & set global variables
export async function initContract() {
	return await getBurrow();
}

export function logout(walletConnection: WalletConnection) {
	walletConnection.signOut();
	// reload page
	window.location.replace(window.location.origin + window.location.pathname);
}

export async function login(walletConnection: WalletConnection) {
	// Allow the current app to make calls to the specified contract on the
	// user's behalf.
	// This works by creating a new access key for the user's account and storing
	// the private key in localStorage.
	await walletConnection.requestSignIn({
		contractId: LOGIC_CONTRACT_NAME,
	});
}
