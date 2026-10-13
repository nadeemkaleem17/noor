// Signing in to the admin the way a person does: the address bar, the form, the authenticator code.
import { expect } from '@playwright/test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { dataDir, password, secretsFile, urls } from '../env.mjs'
import { codeFor } from './totp.js'

const lastFile = path.join(dataDir, 'totp-last.json')

/** A code the server has not seen yet: one step is used once, so a second code in the same 30 seconds waits for the next step (the last one used is kept in a file: the set-up and the journeys are different processes). @param {string} secret */
async function freshCode(secret) {
  const last = existsSync(lastFile) ? JSON.parse(readFileSync(lastFile, 'utf8')) : {}
  let code = codeFor(secret)
  while (last[secret] === code) {
    await new Promise((r) => setTimeout(r, 1000))
    code = codeFor(secret)
  }
  writeFileSync(lastFile, JSON.stringify({ ...last, [secret]: code }))
  return code
}

/** The authenticator secret that global-setup kept for a person. @param {string} who a key of `staff` */
export const secretOf = (who) => JSON.parse(readFileSync(secretsFile, 'utf8'))[who]

/** Fills the email and password and presses Sign in. @param {import('@playwright/test').Page} page @param {{ email: string }} who */
async function sendPassword(page, who) {
  await page.goto(`${urls.admin}/login`)
  await page.getByLabel('Email').fill(who.email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

/**
 * The forced set-up after the first sign-in: scan (here: read the key), the first code, keep the recovery codes.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>} the secret, to make later codes
 */
export async function enrolTwoFactor(page) {
  await expect(page.getByRole('heading', { name: 'Set up two-step sign-in' })).toBeVisible()
  await page.getByRole('button', { name: 'Start set-up' }).click()
  const key = page.getByLabel('Setup key')
  if (!(await key.isVisible().catch(() => false))) {
    // the server asked for the password again
    const again = page.getByLabel('Confirm your password')
    if (await again.isVisible().catch(() => false)) {
      await again.fill(password)
      await page.getByRole('button', { name: 'Confirm and continue' }).click()
    }
  }
  await expect(key).toBeVisible()
  const secret = ((await key.textContent()) ?? '').replace(/\s+/g, '')
  await page.getByLabel('6-digit code').fill(await freshCode(secret))
  await page.getByRole('button', { name: 'Verify' }).click()
  await page.getByRole('checkbox', { name: 'I have saved these codes' }).check()
  await page.getByRole('button', { name: 'Done' }).click()
  return secret
}

/**
 * Signs in. With a secret, answers the second step; without one, the account has no two-step yet and `enrol` says so.
 * @param {import('@playwright/test').Page} page
 * @param {{ email: string }} who
 * @param {string} [secret]
 */
export async function signIn(page, who, secret) {
  await sendPassword(page, who)
  if (secret) {
    await page.getByLabel('6-digit code').fill(await freshCode(secret))
    await page.getByRole('button', { name: 'Verify' }).click()
  }
}
