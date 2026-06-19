import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@bondflow/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
});
