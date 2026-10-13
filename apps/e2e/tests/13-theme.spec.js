// E2E-13: staff change the shop's colours: a pair that cannot be read is refused, a readable one is saved and the storefront wears it (plan/13-quality.md section 4).
import { expect, test } from '../support/test.js'
import path from 'node:path'
import { dataDir, urls } from '../env.mjs'

test.use({ storageState: path.join(dataDir, 'owner.json') })

/** The shop keeps its settings in memory for 30 seconds (apps/storefront/app/lib/shell.server.js): a saved theme shows within that, not at once. @param {import('@playwright/test').Page} shop @param {string} colour */
const shows = (shop, colour) =>
  expect.poll(async () => (await shop.reload(), buttonColour(shop)), { timeout: 45_000, intervals: [3_000] }).toBe(colour)

const buttonColour = (/** @type {import('@playwright/test').Page} */ shop) =>
  shop.getByRole('button', { name: /Add to cart|Select / }).first().evaluate((e) => getComputedStyle(e).backgroundColor)

test.setTimeout(150_000)
test('E2E-13 the theme is blocked by contrast, then saved and shown by the shop', async ({ page, browser }) => {
  const shop = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage()
  await shop.goto('/p/cotton-kurta')
  const before = await buttonColour(shop)

  await page.goto(`${urls.admin}/settings/appearance`)
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible()

  // text on the accent almost the colour of the accent: nobody could read a button
  await page.getByRole('textbox', { name: 'Accent (buttons)', exact: true }).fill('#C9A227')
  await page.getByRole('textbox', { name: 'Text on the accent', exact: true }).fill('#D6B53A')
  // the screen says which pair fails and will not save
  await expect(page.getByRole('row', { name: /Button text on the accent/ })).toContainText('Fails: blocks Save')
  await expect(page.getByRole('button', { name: 'Save' }).first()).toBeDisabled()
  await shop.reload()
  expect(await buttonColour(shop)).toBe(before)

  // a readable pair: white on a deep green
  await page.getByRole('textbox', { name: 'Accent (buttons)', exact: true }).fill('#0B6E4F')
  await page.getByRole('textbox', { name: 'Text on the accent', exact: true }).fill('#FFFFFF')
  await page.getByRole('button', { name: 'Save' }).first().click()
  await expect(page.getByText('Saved').first()).toBeVisible()

  await shows(shop, 'rgb(11, 110, 79)')

  // put the shop back as it was
  await page.getByRole('button', { name: /^Reset to / }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset' }).click()
  await page.getByRole('button', { name: 'Save' }).first().click()
  await expect(page.getByText('Saved').first()).toBeVisible()
  await shows(shop, before)
})
