// Customers with visits and highlight rules (plan/17-owner-requests-2026-10.md section 6): a browser is counted without a name, becomes a customer's visits when it
// places an order, and staff colour customers by rules they write in the admin.
import path from 'node:path'
import { dataDir, urls } from '../env.mjs'
import { adminApi } from '../support/api.js'
import { expectNoViolations } from '../support/axe.js'
import { uniquePhone } from '../support/buyer.js'
import { addToCart, fillCheckout, orderNumber } from '../support/shop.js'
import { expect, test } from '../support/test.js'

const run = Date.now().toString(36).slice(-5)
const name = `Visitor Zareen ${run}`
// a person's browser: the shop does not count programs, and a headless browser says it is one
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

test.describe.configure({ mode: 'serial' })

test('a browser is counted once for a stay, and its visits become the customer\'s when it orders', async ({ browser }) => {
  const context = await browser.newContext({ userAgent })
  const page = await context.newPage()
  const counted = page.waitForResponse((r) => r.url().endsWith('/visit') && r.request().method() === 'POST')
  await page.goto('/')
  expect((await counted).status()).toBe(204)
  const cookie = (await context.cookies()).find((c) => c.name === 'nc_vid')
  expect(cookie?.value, 'a random number, nothing else').toMatch(/^[0-9a-f]{32}$/)
  expect(cookie?.httpOnly).toBe(true)

  await addToCart(page, 'cotton-kurta', 'M')
  await page.goto('/checkout')
  await fillCheckout(page, { name, phone: uniquePhone() })
  await page.getByRole('button', { name: 'Place order' }).click()
  await orderNumber(page)
  await context.close()
})

test('a browser that asks not to be tracked is not counted and gets no cookie', async ({ browser }) => {
  const context = await browser.newContext({ userAgent, extraHTTPHeaders: { 'Sec-GPC': '1' } })
  const page = await context.newPage()
  const answer = page.waitForResponse((r) => r.url().endsWith('/visit') && r.request().method() === 'POST')
  await page.goto('/')
  expect((await answer).status()).toBe(204)
  expect((await context.cookies()).some((c) => c.name === 'nc_vid')).toBe(false)
  await context.close()
})

test.describe('in the admin', () => {
  test.use({ storageState: path.join(dataDir, 'owner.json') })

  test('the customer shows the visit, the colour the first rule gives, and the website figures count it', async ({ page }) => {
    await page.goto(`${urls.admin}/customers?q=${encodeURIComponent(`Visitor Zareen ${run}`)}`)
    const row = page.getByRole('row', { name: new RegExp(name) })
    await expect(row).toBeVisible()
    await expect(row.getByText('New customer')).toBeVisible() // one order: the first rule's range
    await expect(row.getByText('Repeat visitor')).toHaveCount(0) // one visit is not a repeat
    const strip = page.getByRole('region', { name: 'Website visits' })
    await expect(strip.getByText('Became customers')).toBeVisible()
    await expect(strip.getByText('Visitors', { exact: true }).locator('xpath=following-sibling::dd[1]')).not.toHaveText('0')
    await expectNoViolations(page)

    await row.getByRole('link', { name }).click()
    const block = page.getByRole('region', { name: 'Website visits' })
    await expect(block.getByText('Visits', { exact: true }).locator('xpath=following-sibling::dd[1]')).toHaveText('1')
    await expect(block.getByText('/', { exact: true })).toBeVisible() // where the visit began
  })

  test('staff add a rule for visits, the customer gets its colour, and deleting the rule takes it away', async ({ page }) => {
    // a run that stopped half way leaves its rule behind, and an older rule of the same range would win: start without any
    const api = await adminApi()
    const { items } = await api.get('/admin/customers/highlight-rules')
    await api.put('/admin/customers/highlight-rules', { rules: items.filter((/** @type {{ label: string }} */ r) => !r.label.startsWith('First ')) })
    await api.dispose()
    await page.goto(`${urls.admin}/customers/highlights`)
    await expect(page.getByRole('heading', { name: 'Highlight rules' })).toBeVisible()
    await page.getByRole('button', { name: 'Add a rule' }).click()
    const groups = page.getByRole('group', { name: /^Rule \d+/ })
    const added = groups.last()
    await added.getByLabel('Counts').selectOption('visits')
    await added.getByLabel(/^From/).fill('1')
    await added.getByLabel(/Name shown/).fill(`First ${run}`)
    await added.getByLabel(/^Colour picker/).fill('#ff00aa')
    await expectNoViolations(page)
    await page.getByRole('button', { name: 'Save rules' }).click()
    await expect(page.getByText('Highlight rules saved').first()).toBeVisible()

    await page.goto(`${urls.admin}/customers?q=${encodeURIComponent(name)}`)
    const row = page.getByRole('row', { name: new RegExp(name) })
    // the customer has one visit, so this rule colours them as well as the one for their order
    const chip = row.getByText(`First ${run}`)
    await expect(chip).toBeVisible()
    await expect(chip).toHaveCSS('background-color', 'rgb(255, 0, 170)')
    await expect(row.getByText('New customer')).toBeVisible()

    // delete it again, so a second run of this file starts from the same rules
    await page.goto(`${urls.admin}/customers/highlights`)
    // saved rules are listed by kind and range, so this one is found by its name
    const mine = page.getByRole('group', { name: /^Rule \d+/ }).filter({ has: page.locator(`input[value="First ${run}"]`) })
    await expect(mine).toHaveCount(1)
    await mine.getByRole('button', { name: /^Delete rule/ }).click()
    await page.getByRole('button', { name: 'Save rules' }).click()
    await expect(page.getByText('Highlight rules saved').first()).toBeVisible()
    await page.goto(`${urls.admin}/customers?q=${encodeURIComponent(name)}`)
    await expect(page.getByRole('row', { name: new RegExp(name) }).getByText('New customer')).toBeVisible()
    await expect(page.getByText(`First ${run}`)).toHaveCount(0)
  })
})
