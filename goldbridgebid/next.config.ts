import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "350mb",
    },
  },
  serverExternalPackages: ["ffmpeg-static"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "tile.openstreetmap.org",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
