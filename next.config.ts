import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  outputFileTracingIncludes: {'/api/**/*':['./src/prompts/**/*.md','./src/field-packs/**/*.json']},
  outputFileTracingExcludes: {'*':['.env*','.tmp/**/*','.git/**/*','tests/**/*','docs/**/*','**/*.test.ts']},
};

export default config;
