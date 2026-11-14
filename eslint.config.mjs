import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import path from 'node:path';

const moduleBoundary = {
  meta: { type: 'problem', schema: [], messages: { private: 'Import another module through its public index.ts.' } },
  create(context) {
    const current = context.filename.replaceAll('\\', '/');
    const own = current.match(/\/src\/modules\/([^/]+)\//)?.[1];
    function check(node) {
      const source = node.source?.value;
      if (typeof source !== 'string') return;
      const target = source.startsWith('@/')
        ? path.resolve('src', source.slice(2))
        : source.startsWith('.') ? path.resolve(path.dirname(current), source) : '';
      const match = target.replaceAll('\\', '/').match(/\/src\/modules\/([^/]+)(?:\/(.*))?$/);
      if (match && match[1] !== own && match[2] && !/^index(?:\.[cm]?[jt]s)?$/.test(match[2])) {
        context.report({ node, messageId: 'private' });
      }
    }
    return { ImportDeclaration: check, ExportNamedDeclaration: check, ExportAllDeclaration: check, ImportExpression: check };
  },
};

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  { rules: { '@next/next/no-html-link-for-pages': 'off' } },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'dist/**', 'coverage/**', '.tmp/**', '.superpowers/**', 'next-env.d.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { architecture: { rules: { 'module-boundary': moduleBoundary } } },
    rules: {
      'architecture/module-boundary': 'error',
      '@next/next/no-html-link-for-pages': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': ['error', {
        patterns: [
          { regex: '^@/modules/[^/]+/(?!index$)', message: 'Import another module through its public index.ts.' },
          { group: ['openai', 'openai/*', '@anthropic-ai/sdk', '@anthropic-ai/sdk/*'], message: 'LLM provider SDKs belong only in src/modules/llm.' },
        ],
      }],
    },
  },
  {
    files: ['src/modules/llm/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ regex: '^@/modules/[^/]+/(?!index$)', message: 'Import another module through its public index.ts.' }],
      }],
    },
  },
]);
