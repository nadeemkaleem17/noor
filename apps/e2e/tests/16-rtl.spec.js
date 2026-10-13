// E2E-16: right-to-left. The Urdu shop (`/ur`) and the admin switched to dir="rtl": the page sits the other way round, nothing overlaps, no sideways scroll,
// and a drawer comes in from the side a reader of that script expects (plan/13-quality.md section 4).
import { expect, test } from '../support/test.js'
import path from 'node:path'
import { dataDir, urls } from '../env.mjs'
import { expectNoViolations } from '../support/axe.js'

/** Boxes of the visible, named things in a row must not cover each other. @param {import('@playwright/test').Locator[]} items */
async function expectNoOverlap(items) {
  const boxes = []
  for (const item of items) {
    const box = await item.first().boundingBox()
    expect(box, 'the element is on the page').not.toBeNull()
    boxes.push(/** @type {NonNullable<typeof box>} */ (box))
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = /** @type {NonNullable<typeof boxes[number]>} */ (boxes[i])
      const b = /** @type {NonNullable<typeof boxes[number]>} */ (boxes[j])
      const apart = a.x + a.width <= b.x + 0.5 || b.x + b.width <= a.x + 0.5 || a.y + a.height <= b.y + 0.5 || b.y + b.height <= a.y + 0.5
      expect(apart, `item ${i} and item ${j} overlap`).toBe(true)
    }
  }
}

const scrollsSideways = (/** @type {import('@playwright/test').Page} */ page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)

test.setTimeout(150_000)

test('E2E-16 the Urdu shop reads right to left and its cart drawer comes from the left', async ({ page, browser }) => {
  // Urdu is off until staff switch it on: Settings, Store, Languages
  const staff = await (await browser.newContext({ storageState: path.join(dataDir, 'owner.json') })).newPage()
  await staff.goto(`${urls.admin}/settings/store`)
  const urdu = staff.getByRole('checkbox', { name: 'Urdu' })
  if (!(await urdu.isChecked())) {
    await urdu.check()
    await staff.getByRole('button', { name: 'Save languages' }).click()
    await expect(staff.getByText('Saved').first()).toBeVisible()
  }
  // the shop keeps its settings for up to 30 seconds
  await expect.poll(async () => (await page.goto('/ur'))?.status(), { timeout: 45_000, intervals: [3_000] }).toBe(200)

  await expect(page.locator('html')).toHaveAttribute('lang', 'ur')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  expect(await scrollsSideways(page)).toBe(false)

  // the logo is at the right edge and the cart at the left, the opposite of the English page
  const logo = page.getByRole('banner').getByRole('link').first()
  const cart = page.getByRole('banner').locator('a[href="/ur/cart"]').first()
  const logoBox = /** @type {NonNullable<Awaited<ReturnType<typeof logo.boundingBox>>>} */ (await logo.boundingBox())
  const cartBox = /** @type {NonNullable<Awaited<ReturnType<typeof cart.boundingBox>>>} */ (await cart.boundingBox())
  expect(logoBox.x).toBeGreaterThan(cartBox.x)
  await expectNoOverlap([logo, page.getByRole('banner').getByRole('navigation').first(), cart])
  await expectNoViolations(page)

  // a product page and a listing keep their layout
  for (const p of ['/ur/c/stitched', '/ur/p/cotton-kurta', '/ur/cart']) {
    await page.goto(p)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    expect(await scrollsSideways(page), p).toBe(false)
  }

  // the cart drawer slides in from the start side of the reader: on the left in RTL, on the right in English
  await page.goto('/ur/p/cotton-kurta')
  await page.getByRole('banner').locator('a[href="/ur/cart"]').first().click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.first()).toBeVisible()
  await page.waitForTimeout(500) // the slide-in
  const box = /** @type {NonNullable<Awaited<ReturnType<typeof drawer.boundingBox>>>} */ (await drawer.first().boundingBox())
  expect(box.x, 'the drawer is against the left edge').toBeLessThan(5)
})

test.describe('the admin turned right to left', () => {
  test.use({ storageState: path.join(dataDir, 'owner.json') })

  test('E2E-16 the menu moves to the right, nothing overlaps, and a side panel comes from the left', async ({ page }) => {
    await page.goto(`${urls.admin}/promos`)
    await expect(page.getByRole('heading', { name: 'Promo codes' })).toBeVisible()
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'))

    const menu = page.getByRole('complementary').first()
    const menuBox = /** @type {NonNullable<Awaited<ReturnType<typeof menu.boundingBox>>>} */ (await menu.boundingBox())
    expect(menuBox.x + menuBox.width, 'the menu is against the right edge').toBeGreaterThan(1280 - 5)
    expect(await scrollsSideways(page)).toBe(false)
    await expectNoOverlap([menu, page.getByRole('main')])

    // the side panel for a new code opens on the far side from the menu
    await page.getByRole('link', { name: /New code/ }).or(page.getByRole('button', { name: /New code/ })).first().click()
    const panel = page.getByRole('dialog').first()
    await expect(panel).toBeVisible()
    const panelBox = /** @type {NonNullable<Awaited<ReturnType<typeof panel.boundingBox>>>} */ (await panel.boundingBox())
    expect(panelBox.x, 'the panel is against the left edge').toBeLessThan(5)
    expect(await scrollsSideways(page)).toBe(false)
  })
})
