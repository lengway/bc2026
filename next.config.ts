import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // Keep the design branch's Tailwind v4 pipeline. Cache Components remains off:
  // the authenticated API uses force-dynamic request handlers and live SSE.
  turbopack: {
    rules: { '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' } },
  },
  outputFileTracingIncludes: {'/api/**/*':['./src/prompts/**/*.md','./src/field-packs/**/*.json']},
  outputFileTracingExcludes: {'*':['.env*','.tmp/**/*','.git/**/*','tests/**/*','docs/**/*','**/*.test.ts']},
};

export default config;
