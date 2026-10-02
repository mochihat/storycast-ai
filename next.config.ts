import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These talk to Node directly (websockets, DOM emulation) and must not be bundled.
  serverExternalPackages: ["msedge-tts", "jsdom"],
  images: { unoptimized: true },
};

export default nextConfig;
