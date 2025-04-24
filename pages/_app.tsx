import { useEffect, useState } from "react";
import Head from "next/head";
import { Provider } from "react-redux";
import type { AppProps } from "next/app";
import { PersistGate } from "redux-persist/integration/react";
import { init, ErrorBoundary } from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import { ThemeProvider } from "@mui/material/styles";

import "../styles/global.css";
import LoadingBar from "react-top-loading-bar";
import { useRouter } from "next/router";
import { store, persistor } from "../redux/store";
import { FallbackError, Layout, Modal } from "../components";
import { useAppDispatch } from "../redux/hooks";
import { ToastMessage } from "../components/ToastMessage";
import createTheme from "../utils/theme";

// Initialize Sentry with minimal configuration
init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_DEFAULT_NETWORK,
  integrations: [new BrowserTracing()],
  tracesSampleRate: 0.1,
  release: "v1",
});

// Simplified initialization component that doesn't depend on blockchain
const Init = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const init = async () => {
      try {
        console.log('Starting app initialization...');
        
        // Note: We've removed blockchain-dependent initialization
        // The following calls have been commented out as they depend on blockchain.js:
        // await dispatch(fetchConfig());
        // await dispatch(fetchAssets());
        
        console.log('App initialization complete with limited functionality');
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };

    init();
  }, [dispatch]);

  return null;
};

// Safe access to ethereum provider
export const getEthereumProvider = () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    return window.ethereum;
  }
  return null;
};

// Check for ethereum availability
export const hasEthereumProvider = () => {
  return getEthereumProvider() !== null;
};

const MyApp = ({ Component, pageProps }: AppProps) => {
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  
  useEffect(() => {
    // Handle route change start
    const handleStart = () => {
      setProgress(30);
    };
    // Handle route change complete
    const handleComplete = () => {
      setProgress(100);
    };
    
    router.events.on("routeChangeStart", handleStart);
    router.events.on("routeChangeComplete", handleComplete);
    router.events.on("routeChangeError", handleComplete);
    
    return () => {
      router.events.off("routeChangeStart", handleStart);
      router.events.off("routeChangeComplete", handleComplete);
      router.events.off("routeChangeError", handleComplete);
    };
  }, [router]);
  
  useEffect(() => {
    // Set loading to false after a delay to ensure config is loaded
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }
  
  // Use dark theme by default
  const muiTheme = createTheme('dark');
  
  return (
    <ErrorBoundary fallback={FallbackError}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <ThemeProvider theme={muiTheme}>
            <Head>
              <link rel="shortcut icon" href="/favicon.ico" />
              <title>Burrow Cash</title>
              <meta
                name="viewport"
                content="initial-scale=1.0, width=device-width"
              />
            </Head>
            <LoadingBar
              color="#29b6af"
              progress={progress}
              onLoaderFinished={() => setProgress(0)}
            />
            <Init />
            <Modal />
            <ToastMessage />
            <Layout>
              {loading ? (
                <div className="flex items-center justify-center h-screen">
                  <div className="text-white text-xl">Loading...</div>
                </div>
              ) : (
                <Component {...pageProps} />
              )}
            </Layout>
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
};

export default MyApp;
