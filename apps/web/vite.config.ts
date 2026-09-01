import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

const sourcePath = (path: string) => new URL(path, import.meta.url).pathname;

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      allowExternal: true,
      exclude: [
        'src/main.tsx',
        '**/*.test.{ts,tsx}',
        '**/test/**',
        'src/lib/sharedWorkspace.ts',
        'src/lib/notifications.ts',
      ],
      include: [
        sourcePath('./src/lib/**/*.ts'),
        sourcePath('../../packages/application/src/**/*.ts'),
        sourcePath('../../packages/domain/src/**/*.ts'),
        sourcePath('../../packages/storage/src/**/*.ts'),
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
