// E2E-04: the last unit is in two carts; both customers check out. One order is made; the other customer is told, and the cart shows why (plan/13-quality.md section 4).
import { expect, test } from '../support/test.js'
import { adminApi, publicProduct, setAvailable } from '../support/api.js'
import { addToCart, fillCheckout, orderNumber } from '../support/shop.js'

test('E2E-04 two customers want the last unit: one order, one clear message', async ({ browser }) => {
  const api = await adminApi()
  const tote = await publicProduct('leather-tote')
  await setAvailable(api, tote.variants[0].id, 1)
  await api.dispose()

  const first = await (await browser.newContext()).newPage()
  const second = await (await browser.newContext()).newPage()
  await addToCart(first, 'leather-tote')
  await addToCart(second, 'leather-tote')

  // both reach the last step with the unit in the cart
  await first.goto('/checkout')
  await second.goto('/checkout')
  await fillCheckout(first)
  await fillCheckout(second, { name: 'Sana Malik', phone: '0345 1112233' })

  await first.getByRole('button', { name: 'Place order' }).click()
  expect(await orderNumber(first)).toMatch(/^RB-\d+$/)

  await second.getByRole('button', { name: 'Place order' }).click()
  // no order for the second customer: the page says what happened, and the cart no longer offers the unit
  await expect(second).not.toHaveURL(/\/orders\//)
  const alert = second.getByRole('alert')
  await expect(alert).toContainText('Something changed while you were checking out.')
  await expect(alert).toContainText('Leather Tote is sold out')
  await second.goto('/cart')
  await expect(second.getByText('Sold out: remove to continue')).toBeVisible()

  await first.context().close()
  await second.context().close()
})
