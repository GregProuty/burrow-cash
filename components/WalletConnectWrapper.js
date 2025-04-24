import dynamic from 'next/dynamic';
import React from 'react';

// Empty component with proper behavior when not rendered
const EmptyWalletConnectComponent = ({ children }) => {
  // This ensures we're just passing through children
  return <>{children}</>;
};

// Only load wallet connect on the client side
const WalletConnectWrapper = dynamic(() => Promise.resolve(EmptyWalletConnectComponent), {
  ssr: false, // Never render on the server
});

export default WalletConnectWrapper; 