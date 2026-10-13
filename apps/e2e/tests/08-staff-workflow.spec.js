// E2E-08: staff sign in with a password and an authenticator code, then confirm, dispatch and deliver the order of E2E-01 (plan/13-quality.md section 4).
import { expect, test } from '../support/test.js'
import { urls, staff } from '../env.mjs'
import { enrolTwoFactor, signIn } from '../support/admin.js'
import { expectNoViolations } from '../support/axe.js'
import { recall } from '../support/state.js'

test('E2E-08 staff confirm, dispatch and deliver an order @smoke @staff', async ({ browser }) => {
  const { number, url: orderUrl } = recall('order')

  // first sign-in of a new owner: the forced two-step set-up
  const first = await browser.newContext()
  const setup = await first.newPage()
  await signIn(setup, staff.fresh)
  const secret = await enrolTwoFactor(setup)
  await first.close()

  // a later sign-in: password, then the code from the authenticator
  const context = await browser.newContext()
  const page = await context.newPage()
  await signIn(page, staff.fresh, secret)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expectNoViolations(page)

  await page.goto(`${urls.admin}/orders`)
  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible()
  await expectNoViolations(page)
  await page.goto(`${urls.admin}/orders/${number}`)
  await expect(page.getByRole('heading', { name: new RegExp(number) })).toBeVisible()
  await expectNoViolations(page)

  // confirm
  await page.getByRole('button', { name: 'Confirm order' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm order' }).click()
  await expect(page.getByRole('button', { name: 'Mark dispatched' })).toBeVisible()

  // dispatch with a courier and a tracking number
  await page.getByRole('button', { name: 'Mark dispatched' }).click()
  const dispatch = page.getByRole('dialog')
  await dispatch.getByLabel('Courier').selectOption({ index: 1 })
  await dispatch.getByLabel('Tracking number').fill('E2E-TRACK-0001')
  await dispatch.getByRole('button', { name: 'Mark dispatched' }).click()
  await expect(page.getByRole('button', { name: 'Mark delivered' })).toBeVisible()

  // deliver, with the cash taken
  await page.getByRole('button', { name: 'Mark delivered' }).click()
  const deliver = page.getByRole('dialog')
  await deliver.getByRole('checkbox', { name: /Cash received/ }).check()
  await deliver.getByRole('button', { name: 'Mark delivered' }).click()
  await expect(page.getByText('Delivered').first()).toBeVisible()

  // the customer's page agrees
  const customer = await browser.newPage()
  await customer.goto(orderUrl)
  await expect(customer.getByText('Delivered').first()).toBeVisible()
  await customer.close()

  // the invoice has its number now
  const invoice = await context.newPage()
  await invoice.goto(`${urls.admin}/orders/${number}/print`)
  await expect(invoice.getByText(/Invoice INV-\d{4}-\d{6}/)).toBeVisible()
  await invoice.close()

  // the audit log names the person and the three steps, and the sign-in with a code
  await page.goto(`${urls.admin}/audit`)
  const rows = page.getByRole('row').filter({ hasText: number })
  await expect(rows.filter({ hasText: 'confirmed order' })).toHaveCount(1)
  await expect(rows.filter({ hasText: 'dispatched order' })).toHaveCount(1)
  await expect(rows.filter({ hasText: 'delivered order' })).toHaveCount(1)
  await expect(rows.first()).toContainText(staff.fresh.name)
  await expect(page.getByRole('row').filter({ hasText: 'signed in with a code' }).first()).toContainText(staff.fresh.email)
  await context.close()
})
