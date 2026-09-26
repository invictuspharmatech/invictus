import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
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
