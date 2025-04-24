/** @type {import('next').NextConfig} */
const path = require('path');

// Simplest approach - directly define mocks in the config
const walletConnectMocks = {
  '@walletconnect/modal': path.resolve(__dirname, './utils/walletconnect-modal.js'),
  '@walletconnect/sign-client': path.resolve(__dirname, './utils/walletconnect-sign-client.js')
};

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

    // Handle WalletConnect modules
    if (isServer) {
      // For the server build, mark WalletConnect modules as external
      const externals = [...config.externals];
      
      // Add our problematic modules to externals
      config.externals = [
        ...externals,
        '@walletconnect/modal',
        '@walletconnect/sign-client'
      ];
    } else {
      // For the client build, provide polyfills
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

    // Replace problematic modules with our mocks using aliases (this is the key part)
    config.resolve.alias = {
      ...config.resolve.alias,
      ...walletConnectMocks
    };

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
