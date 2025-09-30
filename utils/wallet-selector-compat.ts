import { setupWalletSelector } from "@near-wallet-selector/core";
import type { WalletSelector } from "@near-wallet-selector/core";
import { setupNearWallet } from "@near-wallet-selector/near-wallet";
import { setupSender } from "@near-wallet-selector/sender";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { setupNightly } from "@near-wallet-selector/nightly";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
// Swap to Rhea-patched WalletConnect adapter for Fireblocks compatibility testing
import { setupWalletConnect } from "rhea-wallet-connect";
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
let initPromise: Promise<WalletSelector | null> | null = null;
let selector: WalletSelector | null = null;

// Lazy load to avoid calling getConfig at module load time
const getNearChainId = () => `near:${getConfig(defaultNetwork).networkId}`;
const wcMethods = ["near_getAccounts", "near_signTransaction", "near_signTransactions"];
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.burrow.finance";
const appIcon = process.env.NEXT_PUBLIC_APP_ICON || "https://app.burrow.finance/icon-192.png";
// Prefer the real browser origin so WalletConnect Verify can mark the proposal VALID
const metadataUrl = typeof window !== "undefined" ? window.location.origin : appUrl;

const walletConnect = setupWalletConnect({
  projectId: WALLET_CONNECT_ID,
  metadata: {
    name: "Burrow Cash",
    description: "Burrow with NEAR Wallet Selector",
    url: metadataUrl,
    icons: [appIcon],
  },
  chainId: getNearChainId(),
  // Fireblocks/HERE-safe methods
  methods: wcMethods,
} as any);

const myNearWallet = setupMyNearWallet({
  walletUrl: isTestnet() ? "https://testnet.mynearwallet.com" : "https://app.mynearwallet.com",
});

export const getWalletSelector = async ({ onAccountChange }: GetWalletSelectorArgs) => {
  if (selector) return selector;
  if (initPromise) return initPromise;
  init = true;

  // Only clear cache in browser, not during SSR
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem("near-wallet-selector:selectedWalletId");
      localStorage.removeItem("near-wallet-selector:recentlySignedInWallets");
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  initPromise = setupWalletSelector({
    modules: [
      myNearWallet,
      setupSender() as any,
      setupNearWallet(),
      setupMeteorWallet(),
      walletConnect,
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
    debug: !!isTestnet(), // Only debug on testnet to avoid SSR issues
    optimizeWalletOrder: false,
  })
    .then((sel) => {
      selector = sel;
      return sel;
    })
    .catch((e) => {
      console.error("Wallet selector initialization error:", e);
      selector = null;
      return null;
    })
    .finally(() => {
      initPromise = null;
    });

  selector = await initPromise;

  // Only log in browser to avoid SSR issues
  if (typeof window !== 'undefined') {
    const requiredNamespaces = {
      near: {
        chains: [getNearChainId()],
        methods: wcMethods,
        events: [],
      },
    };
    console.log("Burrow WalletConnect:", {
      network: defaultNetwork,
      isTestnet: isTestnet(),
      chainId: getNearChainId(),
      methods: wcMethods,
      requiredNamespaces,
      projectId: WALLET_CONNECT_ID,
      metadata: { url: metadataUrl, icons: [appIcon] },
    });
    // Extra lifecycle logs to capture wallet-side failures
    try {
      // Pairing stats if available
      const ps: any = (selector as any)?.core?.pairing?.pairings?.getAll?.() || [];
      console.log("WC pairings count:", Array.isArray(ps) ? ps.length : "n/a");
    } catch {}
  }
  if (!selector) return null;
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

let hasLoggedConnection = false;

export const getNear = () => {
  const config = getConfig(defaultNetwork);
  const keyStore = new BrowserLocalStorageKeyStore();
  if (!near) {
    if (!hasLoggedConnection) {
      console.log(`[NEAR Connection] Establishing connection to nodeUrl:`, config.nodeUrl);
      hasLoggedConnection = true;
    }
    near = new Near({
      ...config,
      deps: { keyStore },
    });
    if (hasLoggedConnection) {
      console.log(`[NEAR Connection] Successfully connected to network:`, config.networkId);
    }
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