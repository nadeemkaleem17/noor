// End-to-end run (plan/13-quality.md section 4). `pnpm --filter @noor/e2e test` prepares the scratch database and the builds, then starts the three
// servers below and runs every journey. The browser is the Chrome on this machine (E2E_CHANNEL=chromium for the one Playwright downloads, as CI does).
// The smoke set also runs on WebKit when E2E_WEBKIT=1 (needs `playwright install webkit`).
import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { adminBuildEnv, apiEnv, dataDir, ports, root, storefrontEnv, urls } from './env.mjs'

const channel = (process.env.E2E_CHANNEL ?? 'chrome') === 'chromium' ? undefined : (process.env.E2E_CHANNEL ?? 'chrome')

export default defineConfig({
  testDir: 'tests',
  globalSetup: './global-setup.js',
  // one worker: the journeys share one database, and a stock race or a status change must not meet another journey's order
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: path.join(dataDir, 'report') }]],
  outputDir: path.join(dataDir, 'results'),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: { baseURL: urls.storefront, locale: 'en-GB', timezoneId: 'Asia/Karachi', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) } },
    ...(process.env.E2E_WEBKIT ? [{ name: 'webkit', grep: /@smoke/, use: { ...devices['Desktop Safari'] } }] : []),
  ],
  webServer: [
    { command: 'node src/main.js', cwd: path.join(root, 'apps/api'), env: apiEnv(), url: `${urls.api}/readyz`, reuseExistingServer: false, timeout: 60_000 },
    {
      command: 'node node_modules/@react-router/serve/bin.cjs ./build/server/index.js',
      cwd: path.join(root, 'apps/storefront'),
      env: storefrontEnv(),
      url: urls.storefront,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${ports.admin} --strictPort`,
      cwd: path.join(root, 'apps/admin'),
      env: adminBuildEnv(), // `vite preview` sends the admin's security headers, which name the API's address
      url: urls.admin,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
