// E2E-05: a made-to-order gown in a custom size: the measurements go into the order, and staff see them (plan/13-quality.md section 4).
import { expect, test } from '../support/test.js'
import path from 'node:path'
import { dataDir, urls } from '../env.mjs'
import { fillCheckout, orderNumber } from '../support/shop.js'
import { pressChip } from '../support/ui.js'

test('E2E-05 a custom-size order carries its measurements to the order page and to the admin', async ({ page, browser }) => {
  await page.goto('/p/formal-gown-emerald')
  await expect(page.getByText('Made for you in 15–20 days')).toBeVisible()
  await pressChip(page.getByRole('radio', { name: /^Custom\b/ }))

  // the form refuses what the tailor cannot work with
  await page.getByLabel('Bust (in)').fill('34')
  await page.getByLabel('Waist (in)').fill('28')
  await page.getByLabel('Hip (in)').fill('99')
  await page.getByRole('button', { name: 'Order now' }).click()
  // the browser stops the form at the limit the schema gave the field (60 in), and nothing is added
  expect(await page.getByLabel('Hip (in)').evaluate((e) => /** @type {HTMLInputElement} */ (e).validity.valid)).toBe(false)
  await expect(page).toHaveURL(/\/p\/formal-gown-emerald/)

  await page.getByLabel('Hip (in)').fill('37')
  await page.getByLabel('Dress length (in)').fill('56')
  await page.getByLabel('Notes for the tailor').fill('Sleeves to the wrist please')
  await page.getByRole('button', { name: 'Order now' }).click()
  await expect(page.getByText('Added to cart.')).toBeVisible()

  await page.goto('/cart')
  await expect(page.getByText('Formal Gown Emerald').first()).toBeVisible()
  await expect(page.getByText(/bust/i).first()).toBeVisible()
  await page.getByRole('link', { name: 'Checkout' }).first().click()
  await fillCheckout(page)
  await page.getByRole('button', { name: 'Place order' }).click()

  const number = await orderNumber(page)
  await expect(page.getByText(/bust/i).first()).toBeVisible()
  await expect(page.getByText('37').first()).toBeVisible()

  // staff open the same order and see the same numbers
  const context = await browser.newContext({ storageState: path.join(dataDir, 'owner.json') })
  const admin = await context.newPage()
  await admin.goto(`${urls.admin}/orders/${number}`)
  await expect(admin.getByRole('heading', { name: new RegExp(number) })).toBeVisible()
  await admin.locator('details summary').first().click()
  await expect(admin.getByText('Bust: 34')).toBeVisible()
  await expect(admin.getByText('Hip: 37')).toBeVisible()
  await expect(admin.getByText('Notes: Sleeves to the wrist please')).toBeVisible()
  await context.close()
})
