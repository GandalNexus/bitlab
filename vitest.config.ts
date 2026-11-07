import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@/': `${resolve(process.cwd(), 'src')}/`,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', 'dist/**', 'rust/**/target/**', 'public/**'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
