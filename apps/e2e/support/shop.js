// The customer's steps that several journeys share. Each is what a person does with the page, with the checks that make a wrong page fail here and not later.
import { expect } from '@playwright/test'
import { buyer, uniquePhone } from './buyer.js'
import { pressChip } from './ui.js'

/** Opens a product and adds it (a size when it has one). @param {import('@playwright/test').Page} page @param {string} handle @param {string} [size] */
export async function addToCart(page, handle, size) {
  await page.goto(`/p/${handle}`)
  if (size) await pressChip(page.getByRole('radio', { name: new RegExp(`^${size}\\b`) }))
  await page.getByRole('button', { name: 'Add to cart' }).click()
  await expect(page.getByText('Added to cart.')).toBeVisible()
}

/** Fills the checkout form for the usual customer (with a number of their own: five orders from one number in ten minutes is the API's limit) and chooses cash on delivery. @param {import('@playwright/test').Page} page @param {Partial<typeof buyer>} [who] */
export async function fillCheckout(page, who = {}) {
  const b = { ...buyer, phone: uniquePhone(), ...who }
  await page.getByLabel('Full name').fill(b.name)
  await page.getByLabel('Mobile number').fill(b.phone)
  await page.getByLabel('City').selectOption({ label: b.city })
  await page.getByLabel('Address').fill(b.address)
  await page.getByRole('radio', { name: /standard|delivery/i }).first().check()
  await page.getByRole('radio', { name: /cash on delivery/i }).check()
}

/** The number of the order on the page a placed order lands on. @param {import('@playwright/test').Page} page */
export async function orderNumber(page) {
  await expect(page).toHaveURL(/\/orders\//)
  const text = (await page.getByText(/^Order RB-\d+/).first().textContent()) ?? ''
  const number = /RB-\d+/.exec(text)?.[0]
  expect(number).toBeTruthy()
  return /** @type {string} */ (number)
}
