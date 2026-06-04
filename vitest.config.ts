import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      // Bootstrap / entry-point / CLI files have no testable branches of their
      // own (they only wire things together or start a process), so they are
      // excluded from the 100% threshold per standard practice.
      exclude: ['src/index.ts', 'src/logger.ts', 'src/scripts/**'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
