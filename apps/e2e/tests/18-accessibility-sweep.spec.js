// Not one of the 17 journeys: the pages of the screen-reader pass (plan/13-quality.md section 7: home, listing with filters, product with a choice, cart, checkout with errors,
// REQ: AX-01
// order page; admin: sign-in, orders, an order) and the rest of the storefront and admin screens, each scanned by axe (WCAG 2.2 AA), and the storefront at 320 px (reflow, 1.4.10).
// This finds what a machine can find; the pass with NVDA and TalkBack is a person's (DOC-13 section 12).
import path from 'node:path'
import { dataDir, urls } from '../env.mjs'
import { axeFindings, expectNoViolations } from '../support/axe.js'
import { addToCart } from '../support/shop.js'
import { recall } from '../support/state.js'
import { expect, test } from '../support/test.js'

test.setTimeout(240_000) // many pages, each scanned

const storefront = ['/', '/new', '/sale', '/c/stitched', '/c/stitched?fabric=cotton', '/search?q=kurta', '/search?q=zzzzzz', '/p/cotton-kurta', '/p/formal-gown-emerald', '/p/leather-tote', '/size-guide', '/track', '/wishlist', '/pages/contact', '/pages/about', '/pages/shipping-returns', '/cart', '/no-such-page']

test('a11y: the storefront pages pass axe, and at 320 px they do not scroll sideways', async ({ page }) => {
  /** @type {string[]} */
  const found = []
  for (const path of storefront) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    found.push(...(await axeFindings(page)).map((f) => `${path}: ${f}`))
  }

  // with something in the cart, and the checkout with its errors showing
  await addToCart(page, 'cotton-kurta', 'M')
  for (const path of ['/cart', '/checkout']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    found.push(...(await axeFindings(page)).map((f) => `${path}: ${f}`))
  }
  await page.getByRole('button', { name: 'Place order' }).click()
  await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible()
  found.push(...(await axeFindings(page)).map((f) => `/checkout with errors: ${f}`))
  expect(found).toEqual([])

  await page.setViewportSize({ width: 320, height: 640 })
  for (const path of [...storefront.filter((p) => p !== '/no-such-page'), '/checkout']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), `${path} at 320 px`).toBe(false)
  }
})

test('a11y: the order page and the tracking result pass axe', async ({ page }) => {
  const { url } = recall('order')
  await page.goto(url)
  await expectNoViolations(page)
})

const adminPages = ['/', '/orders', '/orders/new', '/customers', '/promos', '/reviews', '/products', '/categories', '/collections', '/attributes', '/sizes', '/content/home', '/content/pages', '/content/menus', '/settings/store', '/settings/appearance', '/settings/shipping', '/settings/payments', '/settings/data', '/staff', '/audit', '/account']

test.describe('the admin screens', () => {
  test.use({ storageState: path.join(dataDir, 'owner.json') })

  test('a11y: every admin screen passes axe', async ({ page }) => {
    /** @type {string[]} */
    const found = []
    for (const p of adminPages) {
      await page.goto(`${urls.admin}${p}`)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await page.waitForLoadState('networkidle')
      found.push(...(await axeFindings(page)).map((f) => `${p}: ${f}`))
    }
    expect(found).toEqual([])
    const { number } = recall('order')
    await page.goto(`${urls.admin}/orders/${number}`)
    await expect(page.getByRole('heading', { name: new RegExp(number) })).toBeVisible()
    await expectNoViolations(page)
    // the command palette open over the order, and a side panel open over a list
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectNoViolations(page)
    await page.keyboard.press('Escape')
    await page.goto(`${urls.admin}/promos?new=1`)
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectNoViolations(page)
  })

  test('a11y: the sign-in screens pass axe', async ({ browser }) => {
    const page = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage()
    for (const p of ['/login', '/forgot-password']) {
      await page.goto(`${urls.admin}${p}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectNoViolations(page)
    }
    await page.context().close()
  })
})
