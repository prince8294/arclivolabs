import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // CSV import sends the raw file text (up to 5 MB) in a server
    // action; the default 1 MB body limit would reject it.
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
