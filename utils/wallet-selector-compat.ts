import { setupWalletSelector } from "@near-wallet-selector/core";
import type { WalletSelector } from "@near-wallet-selector/core";
import { setupNearWallet } from "@near-wallet-selector/near-wallet";
import { setupSender } from "@near-wallet-selector/sender";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { setupNightly } from "@near-wallet-selector/nightly";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupNeth } from "@near-wallet-selector/neth";
import { setupNearMobileWallet } from "@near-wallet-selector/near-mobile-wallet";
import { setupModal } from "@near-wallet-selector/modal-ui";
import { setupLedger } from "@near-wallet-selector/ledger";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { Near } from "near-api-js/lib/near";
import { Account } from "near-api-js/lib/account";
import { BrowserLocalStorageKeyStore } from "near-api-js/lib/key_stores";
import BN from "bn.js";
import { map, distinctUntilChanged } from "rxjs";

import getConfig, {
  defaultNetwork,
  LOGIC_CONTRACT_NAME,
  WALLET_CONNECT_ID,
  isTestnet,
} from "./config";

declare global {
  interface Window {
    selector: WalletSelector;
    selectorSubscription: any;
    modal: WalletSelectorModal;
    accountId: string;
  }
}

interface WalletMethodArgs {
  signerId?: string;
  contractId?: string;
  methodName?: string;
  args?: any;
  gas?: string | BN;
  attachedDeposit?: string | BN;
}

interface GetWalletSelectorArgs {
  onAccountChange: (accountId?: string | null) => void;
}

// caches in module so we don't re-init every time we need it
let near: Near;
let accountId: string;
let init = false;
let selector: WalletSelector | null = null;

const myNearWallet = setupMyNearWallet({
  walletUrl: isTestnet ? "https://testnet.mynearwallet.com" : "https://app.mynearwallet.com",
});

export const getWalletSelector = async ({ onAccountChange }: GetWalletSelectorArgs) => {
  if (init) return selector;
  init = true;

  selector = await setupWalletSelector({
    modules: [
      myNearWallet,
      setupSender() as any,
      setupNearWallet(),
      setupMeteorWallet(),
      setupHereWallet(),
      setupNightly(),
      setupNeth({
        bundle: false,
        gas: "300000000000000",
      }),
      setupNearMobileWallet({
        dAppMetadata: {
          logoUrl: "https://ref-finance-images.s3.amazonaws.com/images/burrowIcon.png",
          name: "NEAR Wallet Selector",
        },
      }),
      setupLedger(),
    ],
    network: defaultNetwork,
    debug: !!isTestnet,
    optimizeWalletOrder: false,
  });
  const { observable }: { observable: any } = selector.store;
  const subscription = observable
    .pipe(
      map((s: any) => s.accounts),
      distinctUntilChanged(),
    )
    .subscribe((nextAccounts) => {
      console.info("Accounts Update", nextAccounts);
      accountId = nextAccounts[0]?.accountId;
      window.accountId = accountId;
      onAccountChange(accountId);
    });

  const modal = setupModal(selector, { contractId: LOGIC_CONTRACT_NAME });
  window.modal = modal;
  window.selectorSubscription = subscription;

  return selector;
};

export const getNear = () => {
  const config = getConfig(defaultNetwork);
  
  // Handle the case where config might be undefined or missing nodeUrl
  if (!config || !config.nodeUrl) {
    console.warn('Invalid NEAR configuration - using fallback config');
    // Return a fallback configuration to prevent crashes
    const fallbackConfig = {
      networkId: 'mainnet',
      nodeUrl: 'https://rpc.web4.near.page',
      walletUrl: 'https://wallet.near.org',
      helperUrl: 'https://helper.mainnet.near.org',
      explorerUrl: 'https://explorer.mainnet.near.org',
    };
    
    const keyStore = new BrowserLocalStorageKeyStore();
    if (!near) {
      near = new Near({
        ...fallbackConfig,
        deps: { keyStore },
      });
    }
    return near;
  }
  
  const keyStore = new BrowserLocalStorageKeyStore();
  if (!near) {
    near = new Near({
      ...config,
      deps: { keyStore },
    });
  }
  return near;
};

export const getAccount = async (viewAsAccountId?: string | null) => {
  near = getNear();
  return new Account(near.connection, viewAsAccountId || accountId || window.accountId);
};

export const functionCall = async ({
  contractId,
  methodName,
  args,
  gas,
  attachedDeposit,
}: WalletMethodArgs) => {
  if (!selector) {
    throw new Error("selector not initialized");
  }
  if (!contractId) {
    throw new Error("functionCall error: contractId undefined");
  }
  if (!methodName) {
    throw new Error("functionCall error: methodName undefined");
  }

  const wallet = await selector.wallet();

  return wallet.signAndSendTransaction({
    receiverId: contractId,
    actions: [
      {
        type: "FunctionCall",
        params: {
          methodName,
          args,
          gas: gas?.toString() || "30000000000000",
          deposit: attachedDeposit?.toString() || "0",
        },
      },
    ],
  });
};
