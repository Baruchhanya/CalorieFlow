import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from any HTTPS source (for user-uploaded food images)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
