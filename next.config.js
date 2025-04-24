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

    if (isServer) {
      // For server-side rendering, exclude these problematic modules
      const origExternals = [...config.externals];
      
      config.externals = [
        // Exclude WalletConnect modules completely on the server
        (context, request, callback) => {
          if (/@walletconnect\//.test(request)) {
            return callback(null, "commonjs {}");
          }
          callback();
        },
        ...origExternals
      ];
    }

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
