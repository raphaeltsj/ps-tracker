import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let a phone on a hotspot (172.20.10.x) load dev scripts when testing the mobile view.
  allowedDevOrigins: ["172.20.10.*"],
};

export default nextConfig;
