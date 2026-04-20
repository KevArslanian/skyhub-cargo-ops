import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: "c:/Users/argon/.config/superpowers/worktrees/Playground/enterprise-redesign-exec",
  },
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
};

export default nextConfig;
