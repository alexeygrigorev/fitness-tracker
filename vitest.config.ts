// Vitest configuration for fitness-tracker monorepo
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'build', '.expo', 'amplify'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        '**/*.d.ts',
        '**/*.config.{ts,js}',
        '**/test/**',
        'amplify/',
      ],
    },
  },
  resolve: {
    alias: {
      '@fitness-tracker/shared': resolve(__dirname, './packages/shared/src'),
      '@fitness-tracker/ui': resolve(__dirname, './packages/ui/src'),
    },
  },
});
