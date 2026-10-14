// The screen-reader pass (plan/13-quality.md section 12.1): real NVDA on Windows, driven by Guidepup through Playwright, on the same servers as the journeys.
// Not part of `pnpm test:e2e`: it needs NVDA on the machine and a headed Firefox (a screen reader cannot work against a headless browser).
//   once, as administrator, by a person:   npx @guidepup/setup           (installs NVDA, sets the machine up for it)
//   then:                                  pnpm --filter @noor/e2e prepare:data && pnpm --filter @noor/e2e test:sr
import { devices } from '@playwright/test'
import { screenReaderConfig } from '@guidepup/playwright'
import base from './playwright.config.js'

export default {
  ...screenReaderConfig,
  testDir: 'screen-reader',
  outputDir: base.outputDir,
  reportSlowTests: null,
  timeout: 5 * 60 * 1000,
  retries: 1,
  workers: 1,
  use: { baseURL: base.use?.baseURL, locale: 'en-GB', timezoneId: 'Asia/Karachi' },
  // E2E_FIREFOX: the path of another Playwright Firefox; the 155 build of this Playwright fails to start on some Windows machines ("side-by-side configuration is incorrect")
  projects: [{ name: 'firefox-nvda', use: { ...devices['Desktop Firefox'], headless: false, ...(process.env.E2E_FIREFOX ? { launchOptions: { executablePath: process.env.E2E_FIREFOX } } : {}) } }],
  webServer: base.webServer,
}
