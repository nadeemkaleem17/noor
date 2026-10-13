// Making a product through the admin's editor the way staff do: type and category first, a picture with its alt text, the options and variants, then Active and Save.
import { expect } from '@playwright/test'
import { urls } from '../env.mjs'
import { picture } from './picture.js'

/**
 * @typedef {object} NewProduct
 * @property {string} title
 * @property {string} kind the label of the type in the editor ("Stitched", "Accessory", ...)
 * @property {string} category the label of the primary category
 * @property {number} price in rupees
 * @property {string[]} [sizes] size labels, taken from a size system: they become an option called Size
 * @property {string} [sizeSystem] the size system the labels belong to
 * @property {number} [stock] opening stock of each variant
 * @property {boolean} [pieces] an unstitched set needs at least one piece listed
 * @property {{ min: number, max: number }} [lead] made to order: the lead time in days
 */

/** @param {string} title */
export const handleOf = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Fills the editor and saves the product as Active. Returns the handle. @param {import('@playwright/test').Page} page @param {NewProduct} p */
export async function createProduct(page, p) {
  await page.goto(`${urls.admin}/products/new`)
  await expect(page.getByRole('heading', { name: 'New product' })).toBeVisible()
  await page.locator('input[name=title]').fill(p.title)
  await page.locator('select[name=kind]').selectOption({ label: p.kind })
  await page.locator('select[name=primaryCategoryId]').selectOption({ label: p.category })

  await page.locator('#media input[type=file]').setInputFiles(await picture(p.title))
  await page.locator('#media').getByLabel('Alt text').first().fill(`${p.title}, front`)

  if (p.pieces) {
    await page.getByRole('button', { name: 'Add a piece' }).click()
    await page.getByRole('textbox', { name: 'Name', exact: true }).first().fill('Shirt')
  }
  if (p.lead) {
    await page.getByLabel('Shortest lead time in days').fill(String(p.lead.min))
    await page.getByLabel('Longest lead time in days').fill(String(p.lead.max))
  }

  if (p.sizes?.length) {
    await page.getByRole('button', { name: 'Add an option' }).click()
    const option = page.getByRole('group', { name: 'Option 1' })
    await option.getByRole('textbox', { name: 'Name', exact: true }).fill('Size')
    await option.getByRole('combobox', { name: 'Role' }).selectOption({ label: 'Size' })
    await option.getByRole('combobox', { name: 'Size system' }).selectOption({ label: p.sizeSystem ?? '' })
    for (const size of p.sizes) await option.getByRole('group', { name: 'Sizes' }).getByRole('checkbox', { name: size, exact: true }).check()
  }
  await page.getByRole('button', { name: 'Generate variants' }).click()

  const labels = p.sizes?.length ? p.sizes : ['Default']
  await page.getByLabel(`Price ${labels[0]}`, { exact: true }).fill(String(p.price))
  if (labels.length > 1) await page.getByRole('button', { name: 'Apply the first price to all' }).click()
  await page.getByLabel('SKU prefix').fill(handleOf(p.title).toUpperCase().slice(-14).replace(/^-/, ''))
  await page.getByRole('button', { name: 'Fill SKUs' }).click()
  for (const label of labels) {
    if (p.lead) await page.getByLabel(`Stock type ${label}`).selectOption({ label: 'Made to order' })
    else if (p.stock !== undefined) await page.getByLabel(`Opening stock ${label}`).fill(String(p.stock))
  }

  await page.locator('select[name=status]').selectOption({ label: 'Active' })
  await page.getByRole('button', { name: 'Save' }).first().click()
  await expect(page).toHaveURL(/\/products\/(?!new)[0-9a-f-]{20,}/)
  return handleOf(p.title)
}
