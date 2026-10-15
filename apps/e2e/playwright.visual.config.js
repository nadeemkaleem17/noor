// The visual baselines of plan/06-storefront/11-storefront-v2.md §8.2: the same 12 pages at 390, 768 and 1280 px, compared with the saved pictures.
// Not part of `pnpm test:e2e`. It needs the freshly prepared shop (no earlier journey has changed the theme or the language):
//   pnpm --filter @noor/e2e test:visual              compare with the baselines
//   pnpm --filter @noor/e2e test:visual -- --update-snapshots    after a change that is meant to look different: look at the diff first, then save
import path from 'node:path'
import { devices } from '@playwright/test'
import base from './playwright.config.js'

const channel = (process.env.E2E_CHANNEL ?? 'chrome') === 'chromium' ? undefined : (process.env.E2E_CHANNEL ?? 'chrome')
const chrome = { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}), deviceScaleFactor: 1, reducedMotion: /** @type {const} */ ('reduce') }

export default {
  testDir: 'visual',
  snapshotDir: path.join(import.meta.dirname, 'visual/baselines'),
  snapshotPathTemplate: '{snapshotDir}/{arg}-{projectName}{ext}',
  outputDir: base.outputDir,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  timeout: 90_000,
  expect: { timeout: 10_000, toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.01 } },
  use: { baseURL: base.use?.baseURL, locale: 'en-GB', timezoneId: 'Asia/Karachi' },
  projects: [
    { name: 'phone-390', use: { ...chrome, viewport: { width: 390, height: 844 }, isMobile: false, hasTouch: true } },
    { name: 'tablet-768', use: { ...chrome, viewport: { width: 768, height: 1024 } } },
    { name: 'desktop-1280', use: { ...chrome, viewport: { width: 1280, height: 900 } } },
  ],
  webServer: base.webServer,
}
