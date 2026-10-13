// E2E-12: staff publish thirty products at once, and dispatch a batch of orders in which one cannot go: the rest go, the report names the one (plan/13-quality.md section 4).
import { expect, test } from '../support/test.js'
import path from 'node:path'
import { dataDir, urls } from '../env.mjs'
import { adminApi } from '../support/api.js'
import { addToCart, fillCheckout, orderNumber } from '../support/shop.js'

test.use({ storageState: path.join(dataDir, 'owner.json') })

test('E2E-12 thirty products are published in one step', async ({ page, browser }) => {
  const api = await adminApi()
  const tote = (await api.get('/admin/products?q=leather-tote&size=25')).items.find((/** @type {{ handle: string }} */ p) => p.handle === 'leather-tote')
  for (let i = 0; i < 30; i++) await api.post(`/admin/products/${tote.id}/duplicate`)
  expect((await api.get('/admin/products?status=draft&size=100')).total).toBeGreaterThanOrEqual(30)

  await page.goto(`${urls.admin}/products?status=draft&size=50`)
  await page.getByRole('checkbox', { name: 'Select this page' }).check()
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText(/^\d+ published$/).first()).toBeVisible()

  expect((await api.get('/admin/products?status=draft&size=25')).total).toBe(0)
  // one of them, on the shop
  const view = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage()
  await view.goto('/p/leather-tote-copy-30')
  await expect(view.getByRole('heading', { level: 1 })).toContainText('Leather Tote')
  await api.dispose()
})

test('E2E-12 a batch of orders is dispatched, and the one that cannot go is named', async ({ page, browser }) => {
  const api = await adminApi()
  const customer = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage()
  /** @type {string[]} */
  const numbers = []
  for (let i = 0; i < 3; i++) {
    await addToCart(customer, 'embroidered-khussa', '37')
    await customer.goto('/checkout')
    await fillCheckout(customer, { phone: `0333 100000${i}`, name: `Batch Buyer ${i}` })
    await customer.getByRole('button', { name: 'Place order' }).click()
    numbers.push(await orderNumber(customer))
  }
  // two are confirmed by phone, the third is left waiting: it cannot be dispatched yet
  for (const n of numbers.slice(0, 2)) {
    const order = await api.get(`/admin/orders/${n}`)
    await api.post(`/admin/orders/${order.id}/transitions`, { version: order.version, to: 'confirmed', via: 'call' })
  }

  await page.goto(`${urls.admin}/orders`)
  await page.getByRole('button', { name: /^All/ }).click()
  for (const n of numbers) await page.getByRole('checkbox', { name: `Select ${n}` }).check()
  await page.getByRole('button', { name: 'Mark dispatched' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Courier').selectOption({ index: 1 })
  await dialog.getByLabel('Tracking numbers').fill(numbers.map((n, i) => `${n}, TRK-E2E-${i}`).join('\n'))
  await dialog.getByRole('button', { name: 'Mark dispatched' }).click()

  await expect(page.getByText('2 done, 1 failed')).toBeVisible()
  await page.getByRole('button', { name: 'View failures' }).click()
  const report = page.getByRole('dialog', { name: 'Some items failed' })
  await expect(report).toContainText(numbers[2] ?? '')
  await expect(report).not.toContainText(numbers[0] ?? '')

  expect((await api.get(`/admin/orders/${numbers[0]}`)).status).toBe('dispatched')
  expect((await api.get(`/admin/orders/${numbers[1]}`)).status).toBe('dispatched')
  expect((await api.get(`/admin/orders/${numbers[2]}`)).status).toBe('pending_confirmation')
  await api.dispose()
})
