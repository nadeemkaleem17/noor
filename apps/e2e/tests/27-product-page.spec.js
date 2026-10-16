// The product page of plan/06-storefront/11-storefront-v2.md section 5.4 on the seeded shop: the buy box stays in view, the delivery check for a city, the trust points.
// REQ: PD-06, PD-10, PD-14, PD-15
import { expectNoViolations } from '../support/axe.js'
import { expect, test } from '../support/test.js'

/** Opens the first product of a category. @param {import('@playwright/test').Page} page */
async function openProduct(page) {
  await page.goto('/c/stitched')
  await page.locator('article a[href^="/p/"]').first().click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

test('the buy box stays in view beside the pictures and the sections on a wide screen', async ({ page }) => {
  await openProduct(page)
  const box = page.locator('form[id]').first()
  await page.mouse.wheel(0, 600)
  await expect(async () => {
    const at = await box.boundingBox()
    expect(at && at.y < 400 && at.y + at.height > 0, 'the buy box is still on the screen after scrolling').toBe(true)
  }).toPass()
})

test('the delivery block says what delivery costs for the visitor\'s city and remembers it', async ({ page }) => {
  await openProduct(page)
  const block = page.getByRole('region', { name: 'Delivery and returns' })
  await expect(block.getByText(/Delivery in \d+ to \d+ days/)).toBeVisible()
  await block.getByRole('button', { name: 'Check delivery to your city' }).click()
  const city = block.getByRole('combobox', { name: 'Your city' })
  await expect(city).toBeVisible()
  await city.selectOption({ label: 'Lahore' })
  await expect(block.getByRole('status')).toContainText(/To Lahore: .*\d+ to \d+ days/)
  await page.reload()
  await expect(page.getByRole('region', { name: 'Delivery and returns' }).getByRole('combobox', { name: 'Your city' })).toHaveValue(/.+/, { timeout: 15_000 })
  await expect(page.getByRole('region', { name: 'Delivery and returns' }).getByRole('status')).toContainText('To Lahore')
  await expectNoViolations(page)
})

test('the trust points link to the policy and the product can be shared on WhatsApp', async ({ page }) => {
  await openProduct(page)
  const trust = page.getByRole('list', { name: 'Why shop here' })
  await expect(trust.getByRole('link', { name: /Cash on delivery/ })).toHaveAttribute('href', '/pages/shipping-returns')
  await expect(page.getByRole('link', { name: 'Share on WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/)
})
