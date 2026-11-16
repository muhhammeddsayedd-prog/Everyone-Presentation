import { defineConfig, devices } from '@playwright/test';

// EPS_E2E_PORT lets parallel worktrees run their own fixture server (default 3100).
const port = Number(process.env.EPS_E2E_PORT || 3100);
const base = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  // Session-bearing network traces are not suitable for committed acceptance evidence.
  use: { baseURL: base, trace: 'off', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  webServer: { command: 'node tools/dev-test-server.mjs', url: base, reuseExistingServer: false, timeout: 120_000 }
});
