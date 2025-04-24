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
    config.plugins.push(
      new webpack.DefinePlugin({
        "process.env.CONFIG_BUILD_ID": JSON.stringify(buildId),
      }),
    );

    // Add additional plugins to handle WalletConnect better
    config.plugins.push(
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      })
    );

    // Create aliases for WalletConnect modules to use our mocks
    config.resolve.alias = {
      ...config.resolve.alias,
      '@walletconnect/modal': path.resolve(__dirname, './utils/walletconnect-modal.js'),
      '@walletconnect/sign-client': path.resolve(__dirname, './utils/walletconnect-sign-client.js'),
    };

    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ["@svgr/webpack"],
    });

    if (isServer) {
      // Add externals for server-side rendering
      const originalExternals = [...config.externals];
      
      config.externals = [
        (context, request, callback) => {
          // Add specific packages to the externals
          if (/^@walletconnect\//.test(request)) {
            return callback(null, `commonjs ${request}`);
          }
          
          // Process the original externals
          if (typeof originalExternals[0] === 'function') {
            originalExternals[0](context, request, callback);
          } else {
            callback();
          }
        },
        ...(typeof originalExternals[0] === 'function' ? originalExternals.slice(1) : originalExternals),
      ];
    }

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
