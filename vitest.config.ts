import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import frontend from './vitest.config.mts';

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
        test: {
          name: 'backend',
          environment: 'node',
          include: ['src/contracts/**/*.test.ts', 'src/modules/**/*.test.ts', 'tests/backend/**/*.test.ts'],
          restoreMocks: true,
          testTimeout: 15000,
        },
      },
      {
        ...frontend,
        test: {
          ...frontend.test,
          name: 'frontend',
          include: ['src/app/**/*.test.{ts,tsx}', 'src/screens/**/*.test.{ts,tsx}', 'src/ui/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
});
