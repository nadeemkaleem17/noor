// Before the journeys: the owner's two-step set-up (done once per prepared database, through the real screens), kept as a signed-in browser state and the secret.
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { dataDir, secretsFile, staff } from './env.mjs'
import { enrolTwoFactor, signIn } from './support/admin.js'

export default async function globalSetup() {
  // already done by an earlier run on this database (prepare.mjs clears the folder when it makes a new one)
  if (existsSync(secretsFile)) return
  const channel = (process.env.E2E_CHANNEL ?? 'chrome') === 'chromium' ? undefined : (process.env.E2E_CHANNEL ?? 'chrome')
  const browser = await chromium.launch(channel ? { channel } : {})
  mkdirSync(dataDir, { recursive: true })
  /** @type {Record<string, string>} */
  const secrets = {}
  try {
    for (const [name, who] of Object.entries(staff)) {
      if (!who.enrol) continue
      const context = await browser.newContext()
      const page = await context.newPage()
      await signIn(page, who)
      secrets[name] = await enrolTwoFactor(page)
      await page.waitForURL((u) => !u.pathname.startsWith('/enrol-2fa'))
      await context.storageState({ path: path.join(dataDir, `${name}.json`) })
      await context.close()
    }
  } finally {
    await browser.close()
  }
  writeFileSync(secretsFile, JSON.stringify(secrets))
}
