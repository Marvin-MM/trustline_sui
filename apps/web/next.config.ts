import type { NextConfig } from 'next';
import path from 'node:path';
import withBundleAnalyzer from '@next/bundle-analyzer';

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env['ANALYZE'] === 'true',
});

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),

  // Strict mode for development
  reactStrictMode: true,

  // Images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'aggregator.walrus-testnet.walrus.space',
      },
      {
        protocol: 'https',
        hostname: '*.walrus.space',
      },
    ],
  },

  // Security headers
  async headers() {
    const backendUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000';
    const walrusAgg = process.env['NEXT_PUBLIC_WALRUS_AGGREGATOR_URL'] ?? 'https://aggregator.walrus-testnet.walrus.space';

    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `connect-src 'self' ${backendUrl} ${walrusAgg} https://fullnode.testnet.sui.io wss://fullnode.testnet.sui.io`,
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  // Webpack — needed for some blockchain packages
  webpack: (config) => {
    config.externals = config.externals ?? [];
    return config;
  },

  // Transpile workspace packages
  transpilePackages: ['@bondflow/types'],
};

export default bundleAnalyzer(nextConfig);
