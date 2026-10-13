// E2E-10: staff change a stock count and a price in the admin; the storefront shows both at once (the cache is purged, not waited out; plan/13-quality.md section 4).
import { expect, test } from '../support/test.js'
import path from 'node:path'
import { dataDir, urls } from '../env.mjs'
import { expectNoViolations } from '../support/axe.js'

test.use({ storageState: path.join(dataDir, 'owner.json') })

test('E2E-10 a stock change and a price change reach the storefront', async ({ page, browser }) => {
  const shop = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage()
  await shop.goto('/p/statement-jhumka-earrings')
  await expect(shop.getByText('Rs 1,490').first()).toBeVisible()
  await expect(shop.getByText('In stock').first()).toBeVisible()

  await page.goto(`${urls.admin}/products`)
  await page.getByPlaceholder('Search title, SKU or handle…').fill('Jhumka')
  await page.getByRole('link', { name: 'Statement Jhumka Earrings' }).first().click()
  await expect(page.getByRole('heading', { name: 'Statement Jhumka Earrings' })).toBeVisible()
  await expectNoViolations(page)

  // stock: set to three, with a reason; a stock change is its own action, not part of saving the form
  await page.getByRole('button', { name: 'Adjust stock Default' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Change' }).selectOption({ label: 'Set to' })
  await dialog.getByLabel('Quantity').fill('3')
  await dialog.getByRole('combobox', { name: 'Reason' }).selectOption({ label: 'Count correction' })
  await dialog.getByRole('button', { name: 'Apply' }).click()
  await expect(dialog).toBeHidden()

  await shop.reload()
  await expect(shop.getByText('Only 3 left').first()).toBeVisible()

  // price: edited in the variant table and saved with the product
  await page.getByLabel('Price Default', { exact: true }).fill('1590')
  await page.getByRole('button', { name: 'Save' }).first().click()
  await expect(page.getByText('Saved').first()).toBeVisible()

  await shop.reload()
  await expect(shop.getByText('Rs 1,590').first()).toBeVisible()
  await expect(shop.getByText('Rs 1,490')).toHaveCount(0)
  await expect(shop.getByText('Only 3 left').first()).toBeVisible()
})
