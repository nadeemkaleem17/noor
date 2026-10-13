// E2E-15: a whole purchase with the keyboard alone: skip link, product, size, add, cart, checkout, place order. Every stop must show where the focus is (plan/13-quality.md section 4 and 7).
import { expect, test } from '../support/test.js'
import { buyer, uniquePhone } from '../support/buyer.js'
import { orderNumber } from '../support/shop.js'

/** Presses Tab until the wanted element has the focus, and checks the focus can be seen there. @param {import('@playwright/test').Page} page @param {import('@playwright/test').Locator} target @param {number} [max] */
async function tabTo(page, target, max = 150) {
  const spot = target.first()
  for (let i = 0; i < max; i++) {
    if (await spot.evaluate((e) => e === document.activeElement, undefined, { timeout: 2000 }).catch(() => false)) {
      const look = await spot.evaluate((e) => {
        const s = getComputedStyle(e)
        return { outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0, shadow: s.boxShadow !== 'none', sibling: getComputedStyle(e.closest('label')?.querySelector('span') ?? e).boxShadow !== 'none' }
      })
      expect(look.outline || look.shadow || look.sibling, 'the focused element shows a focus ring').toBe(true)
      return
    }
    await page.keyboard.press('Tab')
  }
  throw new Error(`the focus never reached ${target}`)
}

test('E2E-15 a customer buys with the keyboard only', async ({ page }) => {
  await page.goto('/')
  // the skip link is the first stop, and it moves the focus to the content
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()
  await page.keyboard.press('Enter')
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('main')

  // a product from the page
  await tabTo(page, page.getByRole('main').getByRole('link', { name: /Cotton Kurta/ }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Cotton Kurta')

  // the size: arrow keys inside the group, as in any radio group
  const first = page.getByRole('radio').first()
  await tabTo(page, first)
  const m = page.getByRole('radio', { name: /^M\b/ })
  for (let i = 0; i < 8 && !(await m.isChecked()); i++) await page.keyboard.press('ArrowRight')
  expect(await m.isChecked()).toBe(true)

  await tabTo(page, page.getByRole('button', { name: 'Add to cart' }).first())
  await page.keyboard.press('Enter')
  await expect(page.getByText('Added to cart.')).toBeVisible()
  await tabTo(page, page.getByRole('link', { name: 'View cart' }).first())
  await page.keyboard.press('Enter')

  await expect(page.getByRole('heading', { name: 'Your cart', level: 1 })).toBeVisible()
  await tabTo(page, page.getByRole('main').getByRole('link', { name: 'Checkout' }))
  await page.keyboard.press('Enter')

  // the form: every field is reached in turn, the city by typing its name
  await expect(page.getByLabel('Full name')).toBeVisible()
  await tabTo(page, page.getByLabel('Full name'))
  await page.keyboard.type(buyer.name)
  await tabTo(page, page.getByLabel('Mobile number'))
  await page.keyboard.type(uniquePhone())
  await tabTo(page, page.getByLabel('City'))
  await page.keyboard.type(buyer.city)
  await tabTo(page, page.getByLabel('Address'))
  await page.keyboard.type(buyer.address)
  await tabTo(page, page.getByRole('radio', { name: /standard|delivery/i }).first())
  await page.keyboard.press('Space')
  await tabTo(page, page.getByRole('radio', { name: /cash on delivery/i }))
  await page.keyboard.press('Space')
  await tabTo(page, page.getByRole('button', { name: 'Place order' }))
  await page.keyboard.press('Enter')

  expect(await orderNumber(page)).toMatch(/^RB-\d+$/)
})
