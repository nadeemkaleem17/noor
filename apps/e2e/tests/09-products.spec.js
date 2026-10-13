// E2E-09: staff create a product of each kind in the editor, publish it, and the storefront shows what the editor said (plan/13-quality.md section 4, DOC-07.3 section 12).
import { expect, test } from '../support/test.js'
import path from 'node:path'
import { dataDir } from '../env.mjs'
import { expectNoViolations } from '../support/axe.js'
import { createProduct } from '../support/editor.js'

const run = Date.now().toString(36).slice(-4)
const kinds = [
  { title: `E2E Chikankari Kurta ${run}`, kind: 'Stitched', category: 'Women › Stitched', price: 4200, sizeSystem: "Women's stitched", sizes: ['S', 'M', 'L'], stock: 5, size: 'M' },
  { title: `E2E Jacquard Suit ${run}`, kind: 'Unstitched', category: 'Women › Unstitched', price: 6100, pieces: true, stock: 9 },
  { title: `E2E Bridal Sharara ${run}`, kind: 'Made to order', category: 'Women › Bridal & Formals', price: 95000, lead: { min: 20, max: 30 }, text: 'Made for you in 20–30 days' },
  { title: `E2E Peshawari Chappal ${run}`, kind: 'Footwear', category: 'Footwear', price: 3300, sizeSystem: 'Footwear EU', sizes: ['38', '39'], stock: 4, size: '39' },
  { title: `E2E Tassel Scarf ${run}`, kind: 'Accessory', category: 'Accessories', price: 1250, stock: 12 },
]

test.use({ storageState: path.join(dataDir, 'owner.json') })

for (const k of kinds) {
  test(`E2E-09 a ${k.kind.toLowerCase()} product is made in the editor and shown by the shop`, async ({ page }) => {
    const handle = await createProduct(page, k)
    await expectNoViolations(page) // the saved product in the editor

    await page.goto(`/p/${handle}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(k.title)
    await expect(page.getByText(`Rs ${k.price.toLocaleString('en-US')}`).first()).toBeVisible()
    if (k.size) await expect(page.getByRole('radio', { name: new RegExp(`^${k.size}\\b`) })).toBeVisible()
    if (k.text) await expect(page.getByText(k.text).first()).toBeVisible()
    else await expect(page.getByRole('button', { name: /Add to cart|Select / }).first()).toBeVisible()
    await expectNoViolations(page)
  })
}
