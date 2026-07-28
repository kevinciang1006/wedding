import type { NextConfig } from 'next';

// Konva probes for node-canvas at bundle time; the browser build must never resolve it.
const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: { canvas: './lib/stubs/canvas.ts' },
  },
};

export default nextConfig;
