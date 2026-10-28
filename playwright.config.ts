import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  // Session-bearing network traces are not suitable for committed acceptance evidence.
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'off', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  webServer: { command: 'node tools/dev-test-server.mjs', url: 'http://127.0.0.1:3100', reuseExistingServer: false, timeout: 120_000 }
});
