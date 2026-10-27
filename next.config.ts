import type { NextConfig } from "next";

const djangoOrigin = process.env.DJANGO_API_URL ?? "http://127.0.0.1:8000";

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
  // Local/dev: serve Django MEDIA through Next. Live nginx already mounts ./data/media at /media/.
  async rewrites() {
    return [
      {
        source: "/media/:path*",
        destination: `${djangoOrigin}/media/:path*`,
      },
    ];
  },
  agentRules: false,
};

export default nextConfig;
