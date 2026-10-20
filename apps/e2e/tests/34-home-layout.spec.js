// The home page sections staff can move, switch off and size (plan/17-owner-requests-2026-10.md items 2 and 3): prepared as a draft in the admin, looked at through the preview, published,
// and then seen on the shop.
import path from 'node:path'
import { dataDir, urls } from '../env.mjs'
import { adminApi } from '../support/api.js'
import { expect, test } from '../support/test.js'

test.use({ storageState: path.join(dataDir, 'owner.json') })

test('staff move New in to the top, name it, switch Bestsellers off, preview the draft, publish it, and the shop follows', async ({ page, browser }) => {
  const api = await adminApi()
  const before = await api.get('/admin/content/home')
  try {
    await page.goto(`${urls.admin}/content/home`)
    const card = page.getByRole('region', { name: 'Home page sections' })
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: 'Move New in up' }).click()
    await card.getByRole('switch', { name: 'Show Bestsellers' }).click()
    const newIn = card.getByRole('listitem').first()
    await newIn.getByLabel('Heading').fill('Just landed')
    await page.getByRole('button', { name: 'Save draft' }).click()
    await expect(page.getByText('Draft saved').first()).toBeVisible()
    await expect(page.getByText(/You are editing a/)).toBeVisible()

    // the shop does not know about it yet
    const shop = await (await browser.newContext()).newPage()
    await shop.goto('/')
    await expect(shop.getByRole('heading', { name: 'Just landed' })).toHaveCount(0)

    // the preview link shows the draft, with a notice, in a new tab
    const [preview] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Preview draft' }).click()])
    await expect(preview.getByRole('status').filter({ hasText: 'Preview of the unpublished home page' })).toBeVisible()
    await expect(preview.getByRole('heading', { name: 'Just landed' })).toBeVisible()
    await expect(preview.getByRole('heading', { name: 'Bestsellers' })).toHaveCount(0)
    await preview.close()

    // publish: now the shop follows (it keeps its settings for 30 s: look again until the new heading is there)
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Home page published').first()).toBeVisible()
    await expect(async () => {
      await shop.goto('/')
      await expect(shop.getByRole('heading', { name: 'Just landed' })).toBeVisible({ timeout: 1500 })
    }).toPass({ timeout: 45_000 })
    await expect(shop.getByRole('heading', { name: 'Bestsellers' })).toHaveCount(0)
    const ids = await shop.locator('main section[aria-labelledby], main h2[id]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-labelledby') ?? e.id))
    expect(ids.indexOf('home-new'), 'New in comes before the category pictures').toBeLessThan(ids.indexOf('home-categories'))
    await shop.close()
  } finally {
    await api.delete('/admin/content/home/draft').catch(() => undefined)
    // put the home page back as it was, so a second run starts the same
    const now = await api.get('/admin/content/home')
    await api.put('/admin/content/home', { value: before.value, version: now.version })
    await api.dispose()
  }
})
