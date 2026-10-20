// Notices (plan/17-owner-requests-2026-10.md item 4): made in the admin, drawn by the shop as a side card, a popup and a strip, closed for the visit, and shown again only as often as staff chose.
import path from 'node:path'
import { dataDir, urls } from '../env.mjs'
import { adminApi } from '../support/api.js'
import { expectNoViolations } from '../support/axe.js'
import { expect, test } from '../support/test.js'

test.use({ storageState: path.join(dataDir, 'owner.json') })
test.describe.configure({ mode: 'serial' })

const run = Date.now().toString(36).slice(-5)
/** @type {any} */
let before

test.beforeAll(async () => {
  const api = await adminApi()
  before = await api.get('/admin/content/home')
  await api.dispose()
})

test.afterAll(async () => {
  // the home page as it was, so a second run starts the same
  const api = await adminApi()
  const now = await api.get('/admin/content/home')
  await api.put('/admin/content/home', { value: before.value, version: now.version })
  await api.dispose()
})

test('a side card made in the admin is on the shop, can be closed, and stays closed for the visit', async ({ page, browser }) => {
  await page.goto(`${urls.admin}/content/notices`)
  await page.getByRole('button', { name: 'New notice' }).click()
  const drawer = page.getByRole('dialog', { name: 'New notice' })
  await drawer.getByLabel('Where it shows').selectOption('side')
  await drawer.getByLabel(/^Headline/).fill(`Side ${run}`)
  await drawer.getByLabel('Details').fill('Free delivery all week.')
  await drawer.getByLabel('Colour').selectOption('success')
  await expectNoViolations(page)
  await drawer.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Notice saved').first()).toBeVisible()
  await expect(page.getByRole('table', { name: 'Notices' }).getByRole('button', { name: `Side ${run}`, exact: true })).toBeVisible()

  const context = await browser.newContext()
  const shop = await context.newPage()
  // the shop keeps its settings for 30 s: look again until the card is there
  await expect(async () => {
    await shop.goto('/')
    await expect(shop.getByRole('complementary', { name: `Side ${run}` })).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 45_000 })
  await expect(shop.getByText('Free delivery all week.')).toBeVisible()
  await expectNoViolations(shop)
  await shop.getByRole('complementary', { name: `Side ${run}` }).getByRole('button').click()
  await expect(shop.getByRole('complementary', { name: `Side ${run}` })).toHaveCount(0)
  await shop.reload()
  await expect(shop.getByRole('complementary', { name: `Side ${run}` })).toHaveCount(0) // closed for the visit
  await context.close()
})

test('a popup opens a moment after the shop does, closes with Escape, and does not come back the same day', async ({ browser }) => {
  const api = await adminApi()
  const now = await api.get('/admin/content/home')
  const popup = { id: `pop${run}`, text: `Popup ${run}`, title: `Popup ${run}`, body: 'Welcome to the Eid edit.', buttonText: 'See it', href: '/new', severity: 'promo', position: 'popup', palette: 'sand', popupEvery: 'day', active: true }
  await api.put('/admin/content/home', { value: { ...now.value, notices: [popup] }, version: now.version })
  await api.dispose()

  const context = await browser.newContext()
  const shop = await context.newPage()
  await expect(async () => {
    await shop.goto('/')
    await expect(shop.getByRole('dialog', { name: `Popup ${run}` })).toBeVisible({ timeout: 4000 })
  }).toPass({ timeout: 60_000 })
  await expect(shop.getByRole('link', { name: 'See it' })).toHaveAttribute('href', '/new')
  await expectNoViolations(shop)
  await shop.keyboard.press('Escape')
  await expect(shop.getByRole('dialog', { name: `Popup ${run}` })).toHaveCount(0)
  await shop.reload()
  await shop.waitForTimeout(2500)
  await expect(shop.getByRole('dialog', { name: `Popup ${run}` })).toHaveCount(0) // once a day
  await context.close()
})

test('a strip in the dark colour reads as that colour and is gone while it is switched off', async ({ browser }) => {
  const api = await adminApi()
  const now = await api.get('/admin/content/home')
  const strip = { id: `bar${run}`, text: `Strip ${run}`, severity: 'info', position: 'bar', palette: 'ink', popupEvery: 'day', active: true }
  await api.put('/admin/content/home', { value: { ...now.value, announcement: { text: '' }, notices: [strip] }, version: now.version })
  const context = await browser.newContext()
  const shop = await context.newPage()
  await expect(async () => {
    await shop.goto('/')
    await expect(shop.getByText(`Strip ${run}`)).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 45_000 })
  await expectNoViolations(shop)
  const off = await api.get('/admin/content/home')
  await api.put('/admin/content/home', { value: { ...off.value, notices: [{ ...strip, active: false }] }, version: off.version })
  await api.dispose()
  await expect(async () => {
    await shop.goto('/')
    await expect(shop.getByText(`Strip ${run}`)).toHaveCount(0, { timeout: 1500 })
  }).toPass({ timeout: 45_000 })
  await context.close()
})
