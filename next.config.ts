import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        // WASM and worker JS in public/ — never cache; always revalidate.
        // This ensures a freshly rebuilt lnlab_bg.wasm / miner_bg.wasm is
        // picked up immediately after deployment without a hard-refresh.
        source: '/(lnlab|miner)/:file*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
