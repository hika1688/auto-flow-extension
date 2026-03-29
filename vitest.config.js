import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['**/*.test.js', '**/*.spec.js'],
    exclude: ['node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['shared/**', 'content/**', 'background/**', 'popup/**'],
      exclude: ['**/*.test.js', '**/*.spec.js', 'node_modules/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
    reporters: ['verbose'],
  },
});
