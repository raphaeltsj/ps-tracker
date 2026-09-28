import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let a phone on a hotspot (172.20.10.x) or the local network (10.130.1.x) load dev scripts and
  // live updates when testing the mobile view.
  allowedDevOrigins: ["172.20.10.*", "10.130.1.*"],
};

export default nextConfig;
