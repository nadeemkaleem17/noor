// E2E-02: the same purchase with JavaScript switched off (plan/06-storefront/01 section 8 and 05 section 6): every step is a plain form and a plain link.
import { expect, test } from '../support/test.js'
import { buyer } from '../support/buyer.js'
import { orderNumber } from '../support/shop.js'
import { pressChip } from '../support/ui.js'

test.use({ javaScriptEnabled: false })

test('E2E-02 a customer buys with JavaScript off', async ({ page }) => {
  await page.goto('/p/cotton-kurta')
  await pressChip(page.getByRole('radio', { name: /^M\b/ }))
  // the page cannot know the choice without JavaScript, so the button still says what it said before; the server works the variant out from the radios
  await page.getByRole('button', { name: /^(Add to cart|Select )/ }).first().click()

  // the form went to the server and came back to the cart
  await expect(page).toHaveURL(/\/cart/)
  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible()
  await expect(page.getByText('Cotton Kurta').first()).toBeVisible()
  await page.getByRole('link', { name: 'Checkout' }).first().click()

  await page.getByLabel('Full name').fill(buyer.name)
  await page.getByLabel('Mobile number').fill(buyer.phone)
  await page.getByLabel('City').selectOption({ label: buyer.city })
  await page.getByLabel('Address').fill(buyer.address)
  // without JavaScript the delivery options come from a button, not from the change of the city
  await page.getByRole('button', { name: 'Show delivery options' }).click()
  await page.getByRole('radio', { name: /standard|delivery/i }).first().check()
  await page.getByRole('radio', { name: /cash on delivery/i }).check()
  await page.getByRole('button', { name: 'Place order' }).click()

  expect(await orderNumber(page)).toMatch(/^RB-\d+$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Thank you')
})
