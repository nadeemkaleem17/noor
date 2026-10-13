// E2E-03: a valid promo code takes its percentage off the server's total; a code that needs more spending is refused in words (plan/13-quality.md section 4).
import { expect, test } from '../support/test.js'
import { adminApi, createPromo } from '../support/api.js'
import { addToCart } from '../support/shop.js'

const suffix = Date.now().toString(36).toUpperCase().slice(-6)

test('E2E-03 a promo code applies, and one below its minimum spend explains itself', async ({ page }) => {
  const api = await adminApi()
  const ten = `TEN${suffix}`
  const big = `BIG${suffix}`
  await createPromo(api, { code: ten, percent: 10 })
  await createPromo(api, { code: big, percent: 10, minSpendRupees: 50_000 })
  await api.dispose()

  await addToCart(page, 'cotton-kurta', 'M')
  await page.goto('/cart')
  const total = page.getByRole('region', { name: 'Order summary' })
  await expect(total).toContainText('Rs 3,490')

  const code = page.getByLabel('Promo code')
  // the field sits in a closed section until it is asked for
  const apply = async (/** @type {string} */ value) => {
    if (!(await code.isVisible())) await page.getByText('Have a promo code?').click()
    await code.fill(value)
    await page.getByRole('button', { name: 'Apply' }).click()
  }
  await apply(ten)
  // 10% of Rs 3,490 is Rs 349: the page shows the server's number
  await expect(total).toContainText('Rs 349')
  await page.getByRole('button', { name: `Remove code ${ten}` }).click()
  await expect(total).not.toContainText(ten)

  await apply(big)
  await expect(page.getByText('Spend at least Rs 50,000 to use this code.')).toBeVisible()
  await expect(total).not.toContainText('Rs 349')

  await apply('NOSUCHCODE')
  await expect(page.getByText('We do not know this code.')).toBeVisible()
})
