// Using proximity-dex-core (our fork with Lava RPC) with proximity-wallet-connect (our fixed fork)
// Force rebuild v4: Cache bust 2025-10-06-16:17:17
import { setupWalletSelector } from "proximity-dex-core";
import type { WalletSelector } from "proximity-dex-core";
import { setupNearWallet } from "@near-wallet-selector/near-wallet";
import { setupSender } from "@near-wallet-selector/sender";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { setupNightly } from "@near-wallet-selector/nightly";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
// Using proximity-wallet-connect (our fork with transaction fixes for Fireblocks)
import { setupWalletConnect } from "proximity-wallet-connect";
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
const wcMethods = [
  "near_signIn",                   // Sign in to wallet
  "near_signOut",                  // Sign out from wallet
  "near_getAccounts",              // Get connected accounts
  "near_signTransaction",          // Sign single transaction (no send)
  "near_signTransactions",         // Sign multiple transactions (no send) - RHEA USES THIS!
  "near_signAndSendTransaction",   // Sign + send single transaction
  "near_signAndSendTransactions"   // Sign + send multiple transactions
];
console.log("🔧 BURROW CONFIG: wcMethods array =", wcMethods);
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
  // Try alternative relay if default fails
  relayUrl: "wss://relay.walletconnect.org",
  // Fireblocks/HERE-safe methods
  methods: wcMethods,
  // Add debug logging for WalletConnect events
  debug: true,
  logger: 'debug',
} as any);

const myNearWallet = setupMyNearWallet({
  walletUrl: isTestnet() ? "https://testnet.mynearwallet.com" : "https://app.mynearwallet.com",
});

export const getWalletSelector = async ({ onAccountChange }: GetWalletSelectorArgs) => {
  if (selector) return selector;
  if (initPromise) return initPromise;
  init = true;

  // NOTE: Do NOT clear wallet selector localStorage on init
  // This would prevent WalletConnect session restoration from IndexedDB
  // The wallet selector needs these keys to know which wallet was previously connected

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
    // PROXIMITY FIX: Override rhea-dex-core's hardcoded rpc.mainnet.near.org
    // by passing a custom Network object with Lava RPC
    network: {
      networkId: defaultNetwork,
      nodeUrl: "https://near.lava.build",
      helperUrl: "https://helper.mainnet.near.org",
      explorerUrl: "https://nearblocks.io",
      indexerUrl: "https://api.fastnear.com/v0",
    },
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
    console.log("🔧 Burrow WalletConnect CONFIG:", {
      network: defaultNetwork,
      isTestnet: isTestnet(),
      chainId: getNearChainId(),
      methods: wcMethods,
      requiredNamespaces,
      projectId: WALLET_CONNECT_ID,
      metadata: { url: metadataUrl, icons: [appIcon] },
    });
    console.log("🔧 wcMethods includes near_signAndSendTransactions?", wcMethods.includes("near_signAndSendTransactions"));
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
      
      // Log WalletConnect connection state when accounts update
      if (nextAccounts.length > 0) {
        const wcWallet = selector?.store?.getState?.()?.selectedWalletId;
        if (wcWallet === 'wallet-connect') {
          console.log('🔗 WalletConnect account connected:', {
            accountId,
            timestamp: new Date().toISOString(),
          });
          
          // COMPREHENSIVE IndexedDB monitoring
          const monitorWalletConnectStorage = () => {
            try {
              const dbRequest = indexedDB.open('WALLET_CONNECT_V2_INDEXED_DB');
              dbRequest.onerror = () => {
                console.error('❌ CRITICAL: Cannot open WalletConnect IndexedDB!');
              };
              dbRequest.onsuccess = function(event: any) {
                const db = event.target.result;
                const tx = db.transaction(['keyvaluestorage'], 'readonly');
                const store = tx.objectStore('keyvaluestorage');
                
                // Get ALL WalletConnect keys
                const allKeysRequest = store.getAllKeys();
                allKeysRequest.onsuccess = function() {
                  const allKeys = allKeysRequest.result || [];
                  console.log('📦 WalletConnect IndexedDB Keys:', allKeys.filter((k: string) => k.startsWith('wc@2')));
                };
                
                // Get session data
                const sessionRequest = store.get('wc@2:client:0.3:session');
                sessionRequest.onsuccess = function() {
                  try {
                    const sessions = JSON.parse(sessionRequest.result || '[]');
                    console.log('📊 Total WalletConnect sessions in IndexedDB:', sessions.length);
                    
                    if (sessions.length === 0) {
                      console.error('🚨 NO WALLETCONNECT SESSIONS FOUND! This explains transaction failures.');
                      console.error('🔍 The wallet signed you in but the session was not persisted or was deleted.');
                    } else {
                      sessions.forEach((session: any, idx: number) => {
                        const now = Math.floor(Date.now() / 1000);
                        const isExpired = session.expiry < now;
                        const hoursRemaining = Math.floor((session.expiry - now) / 3600);
                        
                        console.log(`🔍 WalletConnect Session #${idx + 1}:`, {
                          topic: session.topic?.substring(0, 16) + '...',
                          fullTopic: session.topic,
                          expiry: new Date(session.expiry * 1000).toISOString(),
                          expired: isExpired,
                          hoursRemaining: isExpired ? 'EXPIRED' : `${hoursRemaining}h`,
                          peerName: session.peer?.metadata?.name,
                          peerUrl: session.peer?.metadata?.url,
                          methods: session.namespaces?.near?.methods || [],
                          accounts: session.namespaces?.near?.accounts || [],
                        });
                        
                        if (isExpired) {
                          console.error(`⚠️ Session #${idx + 1} is EXPIRED! Transactions will fail.`);
                        }
                      });
                    }
                  } catch (e) {
                    console.error('❌ Could not parse sessions:', e);
                  }
                };
                
                // Check pairing data
                const pairingRequest = store.get('wc@2:core:0.3:pairing');
                pairingRequest.onsuccess = function() {
                  try {
                    const pairings = JSON.parse(pairingRequest.result || '[]');
                    console.log('🔗 Active WalletConnect Pairings:', pairings.length);
                    pairings.forEach((pairing: any, idx: number) => {
                      console.log(`  Pairing #${idx + 1}:`, {
                        topic: pairing.topic?.substring(0, 16) + '...',
                        peerName: pairing.peerMetadata?.name,
                      });
                    });
                  } catch (e) {
                    console.warn('Could not parse pairings');
                  }
                };
              };
            } catch (e) {
              console.error('❌ CRITICAL: IndexedDB access error:', e);
            }
          };
          
          // Monitor immediately and set up periodic monitoring
          monitorWalletConnectStorage();
          
          // Check connection health
          try {
            const wcModule = selector?.wallet?.();
            wcModule.then((wallet) => {
              if (wallet) {
                console.log('✅ WalletConnect wallet module ready', {
                  id: wallet.id,
                  accounts: nextAccounts.length,
                });
              }
            }).catch((err) => {
              console.error('❌ Error getting WalletConnect wallet:', err);
            });
          } catch (e) {
            console.warn('⚠️ Could not verify WalletConnect wallet state:', e);
          }
        }
      }
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