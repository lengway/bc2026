import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: { root: process.cwd() },
  reactStrictMode: true,
  poweredByHeader: false,
};
export default nextConfig;
