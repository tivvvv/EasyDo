import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      exclude: ['src/main.tsx', '**/*.test.{ts,tsx}', '**/test/**'],
      include: [
        'src/lib/**/*.ts',
        '../../packages/domain/src/**/*.ts',
        '../../packages/storage/src/**/*.ts',
      ],
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
