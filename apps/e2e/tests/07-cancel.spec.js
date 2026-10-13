// E2E-07: a customer cancels an order nobody has confirmed yet, and the unit goes back on sale (plan/13-quality.md section 4).
import { expect, test } from '../support/test.js'
import { adminApi, publicProduct, setAvailable } from '../support/api.js'
import { addToCart, fillCheckout, orderNumber } from '../support/shop.js'

test('E2E-07 cancelling a pending order gives the stock back', async ({ page }) => {
  const api = await adminApi()
  const clutch = await publicProduct('embroidered-clutch')
  const variantId = clutch.variants[0].id
  await setAvailable(api, variantId, 5)

  await addToCart(page, 'embroidered-clutch')
  await page.goto('/checkout')
  await fillCheckout(page)
  await page.getByRole('button', { name: 'Place order' }).click()
  const number = await orderNumber(page)
  expect((await publicProduct('embroidered-clutch')).variants[0].available).toBe(4)

  await page.getByRole('button', { name: 'Cancel order' }).click()
  await expect(page.getByRole('alertdialog')).toContainText(`Cancel order ${number}?`)
  await page.getByRole('button', { name: 'Yes, cancel the order' }).click()

  await expect(page.getByText('Cancelled').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0)
  expect((await publicProduct('embroidered-clutch')).variants[0].available).toBe(5)
  await api.dispose()
})
