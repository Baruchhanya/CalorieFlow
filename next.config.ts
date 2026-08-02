import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Rewrite barrel imports to direct module paths so only used icons are bundled
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/weight",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        ],
      },
    ];
  },
  // Allow images from any HTTPS source (for user-uploaded food images)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
