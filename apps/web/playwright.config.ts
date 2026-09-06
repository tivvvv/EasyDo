import { defineConfig, devices } from '@playwright/test';

import { dataServiceOrigin, webOrigin } from './e2e/environment';

export default defineConfig({
  expect: { timeout: 5_000 },
  fullyParallel: false,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  testDir: './e2e',
  workers: 1,
  use: {
    baseURL: webOrigin,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command:
        'cargo run --manifest-path ../desktop/src-tauri/Cargo.toml --features data-service-bin --bin easydo-data-service -- --e2e',
      reuseExistingServer: false,
      timeout: 120_000,
      url: `${dataServiceOrigin}/api/v1/health`,
    },
    {
      command: 'pnpm dev --mode e2e --host 127.0.0.1 --port 5174 --strictPort',
      reuseExistingServer: false,
      url: webOrigin,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
});
