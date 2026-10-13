// Not one of the 17 journeys: DOC-11 section 13, "response headers on storefront, API and admin match section 5.3", on real responses; and the pages working under
// those content security policies (a policy that blocks the page's own script or style shows up as a console error, which is where this looks).
import path from 'node:path'
import { dataDir, urls } from '../env.mjs'
import { addToCart, fillCheckout, orderNumber } from '../support/shop.js'
import { expect, test } from '../support/test.js'

const get = async (/** @type {import('@playwright/test').APIRequestContext} */ request, /** @type {string} */ url) => (await request.get(url)).headers()

test('headers: the API, the storefront and the admin send the headers of the table', async ({ request, page }) => {
  const api = await get(request, `${urls.api}/healthz`)
  expect(api['x-content-type-options']).toBe('nosniff')
  expect(api['referrer-policy']).toBe('no-referrer')
  expect(api['x-frame-options']).toBe('DENY')
  expect(api['content-security-policy']).toContain("default-src 'none'")

  const shop = await get(request, urls.storefront)
  expect(shop['x-content-type-options']).toBe('nosniff')
  expect(shop['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(shop['permissions-policy']).toBe('camera=(), microphone=(), geolocation=(), payment=()')
  expect(shop['cross-origin-opener-policy']).toBe('same-origin')
  const csp = shop['content-security-policy'] ?? ''
  for (const part of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) expect(csp).toContain(part)
  expect(csp).not.toMatch(/script-src[^;]*unsafe-(inline|eval)/)

  // a page about one customer's order tells no other site where it was
  await page.goto('/track')
  const admin = await get(request, urls.admin)
  expect(admin['x-content-type-options']).toBe('nosniff')
  expect(admin['referrer-policy']).toBe('no-referrer')
  expect(admin['x-frame-options']).toBe('DENY')
  expect(admin['permissions-policy']).toBe('camera=(), microphone=(), geolocation=(), payment=()')
  expect(admin['cross-origin-opener-policy']).toBe('same-origin')
  const adminCsp = admin['content-security-policy'] ?? ''
  expect(adminCsp).toContain("script-src 'self';")
  expect(adminCsp).toContain(`connect-src 'self' ${urls.api}`)
  expect(adminCsp).toContain("frame-ancestors 'none'")
})

test('headers: an order page sends no referrer', async ({ page, request }) => {
  await addToCart(page, 'embroidered-clutch')
  await page.goto('/checkout')
  await fillCheckout(page)
  await page.getByRole('button', { name: 'Place order' }).click()
  await orderNumber(page)
  expect((await get(request, page.url()))['referrer-policy']).toBe('no-referrer')
})

/** Collects what the browser says about a blocked script, style, image or connection. @param {import('@playwright/test').Page} page */
function watchPolicy(page) {
  /** @type {string[]} */
  const blocked = []
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) blocked.push(m.text().slice(0, 200))
  })
  page.on('pageerror', (e) => {
    if (/Content Security Policy/i.test(e.message)) blocked.push(e.message.slice(0, 200))
  })
  return blocked
}

test('policy: the shop works under its content security policy', async ({ page }) => {
  const blocked = watchPolicy(page)
  await page.goto('/')
  await page.goto('/c/stitched')
  await addToCart(page, 'cotton-kurta', 'M')
  await page.goto('/cart')
  await page.goto('/checkout')
  await fillCheckout(page)
  await page.getByRole('button', { name: 'Place order' }).click()
  await orderNumber(page)
  await page.waitForLoadState('networkidle')
  expect(blocked).toEqual([])
})

test.describe('the admin', () => {
  test.use({ storageState: path.join(dataDir, 'owner.json') })

  test('policy: the admin works under its content security policy', async ({ page }) => {
    const blocked = watchPolicy(page)
    for (const p of ['/', '/orders', '/products', '/products/new', '/settings/appearance', '/promos?new=1']) {
      await page.goto(`${urls.admin}${p}`)
      // a side panel makes what is behind it inert: it is the panel that is looked for then
      await expect(p.includes('new=1') ? page.getByRole('dialog') : page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await page.waitForLoadState('networkidle')
    }
    await page.keyboard.press('Escape')
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(blocked).toEqual([])
    // the theme script still runs from its file: the page has a theme before the app starts
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toMatch(/light|dark/)
  })
})
