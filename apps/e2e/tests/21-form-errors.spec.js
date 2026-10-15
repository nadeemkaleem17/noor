// Not one of the 17 journeys (M7-09, found by reading the page the way a screen reader does): plan/04-design-system/patterns.md, "On submit with errors": the first invalid
// REQ: CK-08
// field takes the focus, and a live region says how many fields need attention. Without this a person who cannot see the red text hears nothing about the form.
import { addToCart } from '../support/shop.js'
import { expect, test } from '../support/test.js'

test('checkout: a failed submit focuses the first invalid field and says how many need attention', async ({ page }) => {
  await addToCart(page, 'cotton-kurta', 'L')
  await page.goto('/checkout')
  await page.getByRole('button', { name: 'Place order' }).click()

  await expect(page.getByLabel('Full name')).toBeFocused()
  await expect(page.getByRole('status').filter({ hasText: /fields? need/ })).toContainText(/\d fields need your attention/)
  // every field named in the count says what is wrong, through its description
  await expect(page.getByLabel('Full name')).toHaveAccessibleDescription(/full name/i)
  await expect(page.getByLabel('Mobile number')).toHaveAccessibleDescription(/Pakistani mobile number/)
})
