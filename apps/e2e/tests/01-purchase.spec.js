// E2E-01: home -> category -> filter by size and one attribute -> product -> cart -> checkout (cash on delivery) -> order page (plan/13-quality.md section 4).
import { expect, test } from '../support/test.js'
import { expectNoViolations } from '../support/axe.js'
import { pressChip } from '../support/ui.js'
import { buyer } from '../support/buyer.js'
import { remember } from '../support/state.js'


test('E2E-01 a customer browses, filters and buys one item with cash on delivery @smoke', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Rubaya/)

  // home -> a category tile; the seeded home links only to Unstitched, so the size filter is tried on Stitched below
  await page.getByRole('main').getByRole('link', { name: /unstitched/i }).first().click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/unstitched/i)
  await page.getByRole('checkbox', { name: /^Lawn/ }).first().click()
  await expect(page).toHaveURL(/fabric=/)

  // filter by a size and one attribute (a plain GET form: the address says what is chosen)
  await page.goto('/c/stitched')
  // a size is a chip: the input is visually hidden, the label is what a person presses
  await page.getByRole('complementary', { name: 'Filters' }).locator('label').filter({ has: page.locator('input[name=size][value=M]') }).locator('span').first().click()
  await expect(page).toHaveURL(/size=/)
  await page.getByRole('checkbox', { name: /^Cotton/ }).first().click()
  await expect(page).toHaveURL(/fabric=/)
  await expectNoViolations(page)

  // product
  await page.getByRole('link', { name: /cotton kurta/i }).first().click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/cotton kurta/i)
  await pressChip(page.getByRole('radio', { name: /^M\b/ }))
  await page.getByRole('button', { name: 'Add to cart' }).click()
  await expect(page.getByText('Added to cart.')).toBeVisible()

  // cart -> checkout
  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible()
  await page.getByRole('link', { name: 'Checkout' }).first().click()
  await page.getByLabel('Full name').fill(buyer.name)
  await page.getByLabel('Mobile number').fill(buyer.phone)
  await page.getByLabel('City').selectOption({ label: buyer.city })
  await page.getByLabel('Address').fill(buyer.address)
  await page.getByRole('radio', { name: /standard|delivery/i }).first().check()
  await page.getByRole('radio', { name: /cash on delivery/i }).check()
  await expectNoViolations(page)
  await page.getByRole('button', { name: 'Place order' }).click()

  // the order page: a masked name and phone, the server's number and total, cash on delivery
  await expect(page).toHaveURL(/\/orders\//)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thank you, Ayesha K.!')
  const number = /RB-\d+/.exec((await page.getByText(/^Order RB-\d+/).first().textContent()) ?? '')?.[0]
  expect(number).toBeTruthy()
  await expect(page.getByText('0321 ••••321')).toBeVisible()
  await expect(page.locator('main')).not.toContainText('7654321')
  await expect(page.getByText('Rs 3,740').first()).toBeVisible()
  await expect(page.getByText(/cash on delivery/i).first()).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expectNoViolations(page)

  remember('order', { number, url: page.url(), phone: buyer.phone })
})
