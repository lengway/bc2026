import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: { root: process.cwd() },
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source:
          "/:section(api|billing|c|case|certificates|dashboard|design|forgot-password|history|login|onboarding|path|prepare|pressure|reset-password|review|s|settings|signup|verify-email)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  outputFileTracingIncludes: {
    "/api/**/*": ["./src/prompts/**/*.md", "./src/field-packs/**/*.json"],
    "/s/*": ["./src/field-packs/**/*.json"],
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
