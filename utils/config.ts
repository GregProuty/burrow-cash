import { ConnectConfig } from "near-api-js";

export const LOGIC_CONTRACT_NAME = process.env.NEXT_PUBLIC_CONTRACT_NAME as string;
export const DUST_THRESHOLD = 0.001;

export const hiddenAssets = ["meta-token.near", "usn"];
export const lpTokenPrefix = "shadow_ref_v1";

export const defaultNetwork = (process.env.NEXT_PUBLIC_DEFAULT_NETWORK ||
  process.env.NODE_ENV ||
  "development") as any;

const META_TOKEN = { testnet: undefined, mainnet: "meta-token.near" };
const REF_TOKEN = { testnet: "ref.fakes.testnet", mainnet: "token.v2.ref-finance.near" };
export const BRRR_TOKEN = {
  testnet: "test_brrr.1638481328.burrow.testnet",
  mainnet: "token.burrow.near",
};

export const WALLET_CONNECT_ID =
  process.env.NEXT_PUBLIC_WALLET_CONNECT_ID || ("87e549918631f833447b56c15354e450" as string);
  console.log('aloha process.env.NEXT_PUBLIC_WALLET_CONNECT_ID', process.env.NEXT_PUBLIC_WALLET_CONNECT_ID)

export const missingPriceTokens = [REF_TOKEN, META_TOKEN, BRRR_TOKEN];
const getConfig = (env: string = defaultNetwork) => {
  switch (env) {
    case "production":
    case "mainnet":
      return {
        networkId: "mainnet",
        nodeUrl: "https://near.lava.build",
        walletUrl: "https://wallet.near.org",
        helperUrl: "https://helper.mainnet.near.org",
        explorerUrl: "https://explorer.mainnet.near.org",
        liquidationUrl: "https://api.data-service.burrow.finance",
        recordsUrl: "https://indexer.ref.finance",
        SPECIAL_REGISTRATION_TOKEN_IDS: [
          "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
        ],
        NATIVE_TOKENS: [
          "usdt.tether-token.near",
          "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
        ],
        NEW_TOKENS: [
          "usdt.tether-token.near",
          "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
        ],
      } as unknown as ConnectConfig;

    case "development":
    case "testnet":
      return {
        networkId: "testnet",
        nodeUrl: "https://rpc.testnet.near.org",
        walletUrl: "https://wallet.testnet.near.org",
        helperUrl: "https://helper.testnet.near.org",
        explorerUrl: "https://explorer.testnet.near.org",
        liquidationUrl: "https://dev.data-service.ref-finance.com",
        recordsUrl: "https://dev-indexer.ref-finance.com",
        SPECIAL_REGISTRATION_TOKEN_IDS: [
          "3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af",
        ],
        NATIVE_TOKENS: ["usdc.fakes.testnet"],
        NEW_TOKENS: ["usdc.fakes.testnet"],
      } as unknown as ConnectConfig;
    case "betanet":
      return {
        networkId: "betanet",
        nodeUrl: "https://rpc.betanet.near.org",
        walletUrl: "https://wallet.betanet.near.org",
        helperUrl: "https://helper.betanet.near.org",
        explorerUrl: "https://explorer.betanet.near.org",
        SPECIAL_REGISTRATION_TOKEN_IDS: [],
      } as unknown as ConnectConfig;
    case "local":
      return {
        networkId: "local",
        nodeUrl: "http://localhost:3030",
        keyPath: `${process.env.HOME}/.near/validator_key.json`,
        walletUrl: "http://localhost:4000/wallet",
      } as ConnectConfig;
    case "test":
    case "ci":
      return {
        networkId: "shared-test",
        nodeUrl: "https://rpc.ci-testnet.near.org",
        masterAccount: "test.near",
      } as ConnectConfig;
    case "ci-betanet":
      return {
        networkId: "shared-test-staging",
        nodeUrl: "https://rpc.ci-betanet.near.org",
        masterAccount: "test.near",
      } as ConnectConfig;
    default:
      throw Error(`Unconfigured environment '${env}'. Can be configured in src/config.js.`);
  }
};

export const isTestnet = getConfig(defaultNetwork).networkId === "testnet";

export default getConfig;