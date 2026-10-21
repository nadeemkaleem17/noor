// The question before visits are counted (plan/17-owner-requests-2026-10.md section 6): nothing is counted until the visitor accepts, a decline keeps nothing, and the footer lets them change
// their mind. The other journeys run with the question switched off (prepare.mjs); this one switches it on for itself.
import path from 'node:path'
import { dataDir } from '../env.mjs'
import { adminApi } from '../support/api.js'
import { expectNoViolations } from '../support/axe.js'
import { expect, test } from '../support/test.js'

test.use({ storageState: path.join(dataDir, 'owner.json') })

/** @param {Awaited<ReturnType<typeof adminApi>>} api @param {boolean} on */
async function askFirst(api, on) {
  const store = await api.get('/admin/settings/store')
  await api.put('/admin/settings/store', { value: { ...store.value, features: { ...store.value.features, visitTracking: true, visitConsent: on } }, version: store.version })
}

test('visits are counted only after the visitor accepts; a decline keeps nothing; the footer reopens the question', async ({ browser }) => {
  const api = await adminApi()
  try {
    await askFirst(api, true)
    const context = await browser.newContext()
    const shop = await context.newPage()
    const visitCookie = async () => (await context.cookies()).find((c) => c.name === 'nc_vid')

    // the shop keeps its settings for 30 s: look again until the question is there
    const notice = shop.getByRole('region', { name: 'Cookies and visit counting' })
    await expect(async () => {
      await shop.goto('/')
      await expect(notice).toBeVisible({ timeout: 1500 })
    }).toPass({ timeout: 45_000 })
    await expectNoViolations(shop)
    expect(await visitCookie(), 'nothing is set before the answer').toBeUndefined()

    // no: nothing kept
    await notice.getByRole('button', { name: 'Decline' }).click()
    await expect(notice).toHaveCount(0)
    await shop.reload()
    await expect(notice).toHaveCount(0) // the answer is remembered
    expect(await visitCookie()).toBeUndefined()

    // the footer asks again; yes: counted, with a number the page cannot read
    await shop.getByRole('button', { name: 'Cookie choices' }).click()
    await expect(notice).toBeVisible()
    const counted = shop.waitForResponse((r) => r.url().endsWith('/visit') && r.request().method() === 'POST')
    await notice.getByRole('button', { name: 'Accept' }).click()
    expect((await counted).status()).toBe(204)
    await expect(notice).toHaveCount(0)
    await expect.poll(async () => (await visitCookie())?.httpOnly).toBe(true)
    await context.close()
  } finally {
    await askFirst(api, false).catch(() => undefined)
    await api.dispose()
  }
})
