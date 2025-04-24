// This is a complete mock for the @near-wallet-selector/wallet-connect module
// It provides all the functionality expected by the NEAR Wallet Selector but without external dependencies

// Create a function that matches the expected setupWalletConnect export
export const setupWalletConnect = () => {
  return {
    id: 'wallet-connect',
    type: 'hardware',
    metadata: {
      name: 'WalletConnect',
      description: 'Wallet Connect (disabled in this build)',
      iconUrl: 'https://raw.githubusercontent.com/walletconnect/walletconnect-assets/master/Icon/Gradient/Icon.png',
      deprecated: false,
      available: false
    },
    init: () => {
      return {
        signOut: async () => {},
        signIn: async () => {
          throw new Error('WalletConnect is not available in this build.');
        },
        getAccounts: async () => [],
        verifyOwner: async () => false,
        signMessage: async () => ({ signature: '' }),
        signAndSendTransaction: async () => ({ response: { hash: '' } }),
        signAndSendTransactions: async () => ({ response: [{ hash: '' }] })
      };
    }
  };
};

// Also provide as default export for maximum compatibility
export default setupWalletConnect; 