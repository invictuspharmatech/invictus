import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "greatlifepharma.com",
        pathname: "/**",
      },
    ],
  },
  agentRules: false,
};

export default nextConfig;
