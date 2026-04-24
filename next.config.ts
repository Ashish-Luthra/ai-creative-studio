import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  /** HMR when the tab uses 127.0.0.1 vs localhost, or the machine’s LAN host (add yours if different). */
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.3"],
};

export default nextConfig;
