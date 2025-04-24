import { useEffect, useState } from "react";
import Head from "next/head";
import { Provider } from "react-redux";
import type { AppProps } from "next/app";
import { PersistGate } from "redux-persist/integration/react";
import { init, ErrorBoundary } from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import posthogJs from "posthog-js";
import { useIdle, useInterval } from "react-use";

import "../styles/global.css";
import LoadingBar from "react-top-loading-bar";
import { useRouter } from "next/router";
import { store, persistor } from "../redux/store";
import { FallbackError, Layout, Modal } from "../components";
import { posthog, isPostHogEnabled } from "../utils/telemetry";
import { useAppDispatch } from "../redux/hooks";
import { fetchAssets, fetchRefPrices } from "../redux/assetsSlice";
import { fetchAccount } from "../redux/accountSlice";
import { fetchConfig } from "../redux/appSlice";
import { ToastMessage } from "../components/ToastMessage";

const SENTRY_ORG = process.env.NEXT_PUBLIC_SENTRY_ORG as string;
const SENTRY_PID = process.env.NEXT_PUBLIC_SENTRY_PID as unknown as number;

const integrations = [new BrowserTracing()] as Array<any>;

if (isPostHogEnabled) {
  integrations.push(new posthogJs.SentryIntegration(posthog, SENTRY_ORG, SENTRY_PID));
}

init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_DEFAULT_NETWORK,
  integrations,
  tracesSampleRate: 0.1,
  release: "v1",
});

const IDLE_INTERVAL = 30e3;
const REFETCH_INTERVAL = 60e3;

const Init = () => {
  const isIdle = useIdle(IDLE_INTERVAL);
  const dispatch = useAppDispatch();

  const fetchData = () => {
    dispatch(fetchAssets()).then(() => dispatch(fetchRefPrices()));
    dispatch(fetchAccount());
  };

  useEffect(() => {
    dispatch(fetchConfig());
  }, []);
  useEffect(fetchData, []);
  useInterval(fetchData, !isIdle ? REFETCH_INTERVAL : null);

  return null;
};

export default function MyApp({ Component, pageProps }: AppProps) {
  const [progress, setProgress] = useState(0);
  const router = useRouter();
  useEffect(() => {
    router.events.on("routeChangeStart", () => {
      setProgress(30);
    });
    router.events.on("routeChangeComplete", () => {
      setProgress(100);
    });
  }, []);
  return (
    <ErrorBoundary fallback={FallbackError}>
      <LoadingBar
        color="#D2FF3A"
        height={3}
        progress={progress}
        onLoaderFinished={() => setProgress(0)}
      />
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <Head>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Burrow Cash</title>
          </Head>
          <Layout>
            <Init />
            <Modal />
            <ToastMessage />
            <Component {...pageProps} />
          </Layout>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
}
