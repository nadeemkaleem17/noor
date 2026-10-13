// E2E-11: a viewer can read what the role allows and finds no way to change anything; a screen the role may not open says so (plan/13-quality.md section 4).
import { expect, test } from '../support/test.js'
import { staff, urls } from '../env.mjs'
import { signIn } from '../support/admin.js'
import { recall } from '../support/state.js'

const lists = ['/orders', '/products', '/categories', '/collections', '/attributes', '/sizes']
const forbidden = ['/staff', '/settings/store', '/promos', '/products/new', '/content/pages', '/audit']

test('E2E-11 a viewer sees no write controls and is stopped at forbidden screens', async ({ page }) => {
  await signIn(page, staff.viewer)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  // the menu offers only what the role may open
  const menu = page.getByRole('navigation', { name: 'Main' })
  await expect(menu.getByRole('link', { name: 'Orders' })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Products' })).toBeVisible()
  for (const name of ['Promo codes', 'Staff & roles', 'Audit log', 'Store']) await expect(menu.getByRole('link', { name })).toHaveCount(0)

  for (const path of lists) {
    await page.goto(`${urls.admin}${path}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText('You don\'t have access to this page')).toHaveCount(0)
    // nothing that creates, removes, imports or selects rows for a bulk change
    await expect(page.getByRole('main').getByRole('button', { name: /^(New|Add|Create|Delete|Import|Invite|Duplicate)/ })).toHaveCount(0)
    expect(await page.getByRole('main').getByRole('link', { name: /^(New (product|order|collection|category|attribute|size|page|promo)|Add |Create )/i }).allInnerTexts(), path).toEqual([])
  }

  // rows can be selected on the orders list only to print invoices: no bulk change is offered
  await page.goto(`${urls.admin}/orders`)
  await page.getByRole('button', { name: /^All/ }).click()
  await page.getByRole('checkbox', { name: /^Select RB-/ }).first().check()
  await expect(page.getByRole('button', { name: /Print/ }).first()).toBeVisible()
  for (const name of ['Confirm', 'Mark dispatched', 'Mark delivered']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)

  // an order opens, and carries no action
  const { number } = recall('order')
  await page.goto(`${urls.admin}/orders/${number}`)
  await expect(page.getByRole('heading', { name: new RegExp(number) })).toBeVisible()
  for (const name of ['Confirm order', 'Mark dispatched', 'Mark delivered', 'Cancel order', 'Record payment', 'Edit address or items']) {
    await expect(page.getByRole('button', { name })).toHaveCount(0)
  }

  // a forbidden address shows the 403 state
  for (const path of forbidden) {
    await page.goto(`${urls.admin}${path}`)
    await expect(page.getByText("You don't have access to this page")).toBeVisible()
  }
})
