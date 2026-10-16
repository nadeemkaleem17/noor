// The bag and the checkout of plan/06-storefront/11-storefront-v2.md section 5.5 on the seeded shop: the free-delivery progress, suggestions, the sticky summary, the trust line.
// REQ: CT-03, CT-06, CK-07, CK-11
import { expectNoViolations } from '../support/axe.js'
import { expect, test } from '../support/test.js'

/** Puts the first in-stock quick-add size of the first card of a category into the bag. @param {import('@playwright/test').Page} page */
async function addFromListing(page) {
  await page.goto('/c/stitched')
  const card = page.locator('article').filter({ has: page.getByText('Quick add', { exact: true }) }).first()
  await card.getByText('Quick add', { exact: true }).click()
  await card.getByRole('button', { name: /^Add size .+ to the bag$/ }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test('the bag says how far free delivery is, with a bar, before any city is chosen', async ({ page }) => {
  await addFromListing(page)
  const bar = page.getByRole('dialog').getByRole('progressbar', { name: 'Progress to free delivery' })
  const free = page.getByRole('dialog').getByText('Delivery is free on this order.')
  // the demo shop's threshold is Rs 3,000 and a piece may be above it: one of the two is always shown
  await expect(bar.or(free)).toBeVisible()
  if (await bar.isVisible()) {
    await expect(page.getByRole('dialog').getByText(/more for free delivery|for free delivery/i)).toBeVisible()
    expect(Number(await bar.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(0)
  }
})

test('the cart page suggests pieces that go with the first one, and the checkout has the trust line and a sticky summary', async ({ page }) => {
  await addFromListing(page)
  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: 'You may also like' })).toBeVisible()
  await expectNoViolations(page)
  await page.goto('/checkout')
  await expect(page.getByText('Pay when it arrives. We confirm every order on WhatsApp or by phone before dispatch.')).toBeVisible()
  const summary = page.getByRole('complementary', { name: 'Order summary' })
  await expect(summary).toBeVisible()
  await page.mouse.wheel(0, 500)
  await expect(async () => {
    const at = await summary.locator('div').first().boundingBox()
    expect(at && at.y >= 0 && at.y < 200, 'the summary stays near the top while the form scrolls').toBe(true)
  }).toPass()
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 800 } })

  test('the total is beside the place-order button', async ({ page }) => {
    await addFromListing(page)
    await page.goto('/checkout')
    const place = page.getByRole('button', { name: 'Place order' })
    await place.scrollIntoViewIfNeeded()
    const total = page.locator('form').getByText('Total', { exact: true }).last()
    await expect(total).toBeVisible()
    const a = await total.boundingBox()
    const b = await place.boundingBox()
    expect(a && b && Math.abs(b.y - a.y) < 200, 'the total is within a screen of the button').toBe(true)
  })
})
