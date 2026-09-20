import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "greatlifepharma.com",
        pathname: "/storage/**",
      },
      {
        protocol: "https",
        hostname: "greatlifepharma.com",
        pathname: "/images/**",
      },
    ],
  },
};

export default nextConfig;
