// The owner's first fixes (plan/17-owner-requests-2026-10.md items 1, 5 and 8): a picture upload that ends, a worker that is running,
// a new product that search finds, and a category with no product yet that the shop still offers.
import path from 'node:path'
import { dataDir, urls } from '../env.mjs'
import { adminApi } from '../support/api.js'
import { createProduct } from '../support/editor.js'
import { picture } from '../support/picture.js'
import { expect, test } from '../support/test.js'

test.use({ storageState: path.join(dataDir, 'owner.json') })

test('a picture chosen in the admin is uploaded, processed and shown, and the spinner is gone', async ({ page }) => {
  await page.goto(`${urls.admin}/settings/store`)
  await expect(page.getByRole('heading', { name: 'Store' }).first()).toBeVisible()
  await page.locator('input[type=file]').first().setInputFiles(await picture('Logo check'))
  await expect(page.getByRole('button', { name: 'Remove image' }).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0) // no failure and no "worker is not running" strip
})

test('the background worker answers, so the admin shows no warning about it', async () => {
  const api = await adminApi()
  const status = await api.get('/admin/background')
  await api.dispose()
  expect(status.state).toMatch(/^(ok|idle)$/)
  expect(status.workers).toBeGreaterThanOrEqual(1)
})

test('a product made in the admin can be found by its first letters right away', async ({ page }) => {
  const title = `Zanjeer Shawl ${Date.now().toString(36)}`
  const handle = await createProduct(page, { title, kind: 'Accessory', category: 'Accessories', price: 4200, stock: 3 })
  const api = await adminApi()
  // the product reaches the index through a background job a moment after it is saved
  await expect.poll(async () => (await api.get('/admin/search-index')).missing, { message: 'nothing is missing from the index', timeout: 30_000 }).toBe(0)
  await api.dispose()
  await page.goto(`/search?q=${encodeURIComponent('zanjeer sha')}`)
  await expect(page.getByRole('link', { name: new RegExp(title) }).first()).toBeVisible()
  expect(handle).toBeTruthy()
})

test('a category with no product yet is still in the shop, with a page that says so', async ({ page }) => {
  const name = `Coming Soon ${Date.now().toString(36)}`
  const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const api = await adminApi()
  await api.post('/admin/categories', { name, handle, parentId: null, visible: true, attributes: [] })
  await api.dispose()
  const response = await page.goto(`/c/${handle}`)
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: new RegExp(`${name}: products are on their way`) })).toBeVisible()
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/)
})
