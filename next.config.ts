import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: { root: process.cwd() },
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/**/*": ["./src/prompts/**/*.md", "./src/field-packs/**/*.json"],
  },
  outputFileTracingExcludes: {
    "*": [
      ".env*",
      ".tmp/**/*",
      ".git/**/*",
      "tests/**/*",
      "docs/**/*",
      "**/*.test.ts",
    ],
  },
};
export default nextConfig;
