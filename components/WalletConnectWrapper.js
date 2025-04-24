import dynamic from 'next/dynamic';
import React from 'react';

// Dynamic component that only loads in browser, not during SSR
const WalletConnectComponent = dynamic(
  () => import('../utils/disable-wallet-connect').then(() => {
    // Return a component that just renders its children
    return ({ children }) => <>{children}</>;
  }),
  { ssr: false }
);

const WalletConnectWrapper = ({ children }) => {
  return <WalletConnectComponent>{children}</WalletConnectComponent>;
};

export default WalletConnectWrapper; 