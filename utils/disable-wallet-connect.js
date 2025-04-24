// This file provides mock implementations for WalletConnect modules
// to prevent ESM/CommonJS compatibility issues during build

// Mock for the WalletConnect modal
export const mockWalletConnectModal = {
  WalletConnectModal: function() { 
    return null; 
  }
};

// Mock for the WalletConnect sign client
export const mockWalletConnectSignClient = {
  SignClient: {
    init: async () => ({
      on: () => {},
      connect: async () => ({}),
      pair: async () => ({}),
      disconnect: async () => {}
    })
  }
};

// Helper function to check if we're in server-side rendering
export const isSSR = () => typeof window === 'undefined';

// Utility to safely load ESM modules at runtime only in the browser
export const loadESMModule = async (moduleName) => {
  if (isSSR()) {
    // Return mock implementations during SSR
    if (moduleName === '@walletconnect/modal') {
      return mockWalletConnectModal;
    }
    if (moduleName === '@walletconnect/sign-client') {
      return mockWalletConnectSignClient;
    }
    return {};
  }
  
  // In browser, try to load the real module
  try {
    // Using dynamic import which works in both ESM and CommonJS environments
    return await import(moduleName);
  } catch (error) {
    console.error(`Error loading module ${moduleName}:`, error);
    // Return mocks as fallback
    if (moduleName === '@walletconnect/modal') {
      return mockWalletConnectModal;
    }
    if (moduleName === '@walletconnect/sign-client') {
      return mockWalletConnectSignClient;
    }
    return {};
  }
}; 