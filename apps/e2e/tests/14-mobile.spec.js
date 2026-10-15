// E2E-14: at 360 x 740 the shop and the admin's orders do not scroll sideways, the product page has its sticky bar, and the main actions can be reached (plan/13-quality.md section 4).
// REQ: MB-04, PD-14
import { expect, test } from '../support/test.js'
import path from 'node:path'
import { dataDir, urls } from '../env.mjs'
import { expectNoViolations } from '../support/axe.js'
import { addToCart, fillCheckout, orderNumber } from '../support/shop.js'

test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true })

/** True when the page is wider than the screen. @param {import('@playwright/test').Page} page */
const scrollsSideways = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)

test('E2E-14 the shop at 360 px: no sideways scroll, a sticky buy bar, a reachable checkout', async ({ page }) => {
  for (const path of ['/', '/c/stitched', '/new', '/p/cotton-kurta', '/size-guide', '/track']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    expect(await scrollsSideways(page), path).toBe(false)
  }

  // product page: the buy bar sticks to the bottom while the main button is out of sight
  await page.goto('/p/cotton-kurta')
  const bar = page.locator('div.fixed.bottom-0').filter({ has: page.getByRole('button') })
  await expect(bar).toBeVisible()
  await expect(bar.getByRole('button')).toBeVisible()
  const box = await bar.boundingBox()
  expect(box && box.y + box.height).toBeCloseTo(740, 0)

  // cart and checkout: the buttons are inside the screen's width and can be pressed
  await addToCart(page, 'cotton-kurta', 'M')
  await page.goto('/cart')
  expect(await scrollsSideways(page), '/cart').toBe(false)
  await page.getByRole('link', { name: 'Checkout' }).first().click()
  expect(await scrollsSideways(page), '/checkout').toBe(false)
  await fillCheckout(page)
  const place = page.getByRole('button', { name: 'Place order' })
  await place.scrollIntoViewIfNeeded()
  const placeBox = await place.boundingBox()
  expect(placeBox && placeBox.x >= 0 && placeBox.x + placeBox.width <= 360).toBe(true)
  expect(placeBox && placeBox.height >= 44).toBe(true)
  await expectNoViolations(page)
  await place.click()
  await orderNumber(page)
  expect(await scrollsSideways(page), 'order page').toBe(false)
})

test.describe('the admin orders at 360 px', () => {
  test.use({ storageState: path.join(dataDir, 'owner.json') })

  test('E2E-14 the orders list is a list of cards and an order can be acted on', async ({ page, browser }) => {
    // a waiting order to open
    const shop = await (await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 360, height: 740 } })).newPage()
    await addToCart(shop, 'cotton-kurta', 'M')
    await shop.goto('/checkout')
    await fillCheckout(shop, { phone: '0344 5550001', name: 'Mobile Buyer' })
    await shop.getByRole('button', { name: 'Place order' }).click()
    const number = await orderNumber(shop)

    await page.goto(`${urls.admin}/orders`)
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible()
    await expect(page.getByText(number).first()).toBeVisible()
    expect(await scrollsSideways(page), 'orders list').toBe(false)
    expect(await page.locator('main table').count(), 'a table is a card list on a phone').toBe(0)
    await expectNoViolations(page)

    await page.goto(`${urls.admin}/orders/${number}`)
    await expect(page.getByRole('heading', { name: new RegExp(number) })).toBeVisible()
    expect(await scrollsSideways(page), 'order page').toBe(false)
    const confirm = page.getByRole('button', { name: 'Confirm order' })
    await confirm.scrollIntoViewIfNeeded()
    const box = await confirm.boundingBox()
    expect(box && box.x >= 0 && box.x + box.width <= 360).toBe(true)
    await confirm.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    const dialog = await page.getByRole('dialog').boundingBox()
    expect(dialog && dialog.x >= 0 && dialog.x + dialog.width <= 360).toBe(true)
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm order' }).click()
    await expect(page.getByRole('button', { name: 'Mark dispatched' })).toBeVisible()
  })
})
