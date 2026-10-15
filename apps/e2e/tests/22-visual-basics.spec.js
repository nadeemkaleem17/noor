// Not one of the 17 journeys (M7-09, found by looking at screenshots; axe cannot see either): the hero's words are white on their dark gradient, and on a phone the chat button does not
// sit under the product page's buy bar. Both were broken by a missing token (`--color-white`), and a button hidden behind a bar.
// REQ: HM-01, SH-09
import { expect, test } from '../support/test.js'

test('home: the hero words are white, on a gradient', async ({ page }) => {
  await page.goto('/')
  const hero = page.getByRole('main').getByRole('heading', { level: 1 })
  await expect(hero).toHaveCSS('color', 'rgb(255, 255, 255)')
  const gradient = await hero.evaluate((h) => getComputedStyle(/** @type {HTMLElement} */ (h.parentElement)).backgroundImage)
  expect(gradient).toMatch(/linear-gradient.*0\.75/)
})

test('product page on a phone: the chat button is not under the buy bar', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto('/p/cotton-kurta')
  const chat = page.getByRole('link', { name: 'Chat with us on WhatsApp' })
  const bar = page.getByRole('button', { name: /Select Size|Add to cart/ }).last()
  const a = /** @type {NonNullable<Awaited<ReturnType<typeof chat.boundingBox>>>} */ (await chat.boundingBox())
  const b = /** @type {NonNullable<Awaited<ReturnType<typeof bar.boundingBox>>>} */ (await bar.boundingBox())
  expect(a.y + a.height, 'the chat button ends above the bar').toBeLessThanOrEqual(b.y)
  await context.close()
})
