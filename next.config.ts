import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "www.gstatic.com",
      },
    ],
  },
  turbopack: {
    // Force Turbopack to use the correct project root to avoid heavy resource usage
    // caused by stray package.json/pnpm-lock.yaml in home directory
    root: __dirname,
  },
};

export default nextConfig;
