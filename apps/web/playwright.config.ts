import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  expect: { timeout: 5_000 },
  fullyParallel: false,
  reporter: 'list',
  testDir: './e2e',
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command:
        'cargo run --manifest-path ../desktop/src-tauri/Cargo.toml --features data-service-bin --bin easydo-data-service -- ../desktop/src-tauri/target/e2e/easydo.db',
      reuseExistingServer: true,
      timeout: 120_000,
      url: 'http://127.0.0.1:24873/api/v1/health',
    },
    {
      command: 'pnpm dev --host 127.0.0.1',
      reuseExistingServer: true,
      url: 'http://localhost:5173',
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
});
