/** @type {import('next').NextConfig} */
const path = require('path');

module.exports = {
  reactStrictMode: true,
  swcMinify: false,
  experimental: {
    forceSwcTransforms: true,
    esmExternals: 'loose',
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  webpack(config, { isServer, webpack, buildId }) {
    // Define build ID
    config.plugins.push(
      new webpack.DefinePlugin({
        "process.env.CONFIG_BUILD_ID": JSON.stringify(buildId),
      })
    );

    // Provide Buffer for the browser
    config.plugins.push(
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      })
    );

    // SVG support
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ["@svgr/webpack"],
    });

    // Set up aliases for problematic modules with different approaches for server/client
    if (isServer) {
      // For server-side, completely exclude these modules to prevent ESM errors
      config.externals = [...config.externals];
      
      // Create a custom externals rule
      config.externals.push(function(context, request, callback) {
        // Skip these problematic modules completely on the server
        if (/@walletconnect\/modal|@walletconnect\/sign-client/.test(request)) {
          // Return an empty object
          return callback(null, "commonjs {}");
        }
        callback();
      });
    }

    // Resolve module aliases - updated with multiple replacement strategies
    config.resolve.alias = {
      ...config.resolve.alias,
      // Replace the wallet-connect module with our mock
      '@near-wallet-selector/wallet-connect': path.resolve(__dirname, './utils/mock-wallet-connect.js'),
      // Replace core with our filtered version that excludes wallet-connect
      '@near-wallet-selector/core': path.resolve(__dirname, './utils/wallet-selector-shim.js'),
    };

    // For client-side builds, provide necessary polyfills
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        buffer: require.resolve('buffer/'),
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        os: require.resolve('os-browserify/browser'),
      };
    }

    return config;
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/unstaking",
        permanent: true,
      },
    ];
  },
};
