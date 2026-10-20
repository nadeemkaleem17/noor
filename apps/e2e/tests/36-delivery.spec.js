// Delivery assignment, the rider's ledger and receipts (plan/18-delivery-assignment-ledger-receipts.md): an order placed by a customer, given to a rider from the Orders list,
// sent out, delivered, and the cash handed in, with the receipts and the ledger to show for it.
import path from 'node:path'
import { dataDir, urls } from '../env.mjs'
import { adminApi } from '../support/api.js'
import { expectNoViolations } from '../support/axe.js'
import { addToCart, fillCheckout, orderNumber } from '../support/shop.js'
import { expect, test } from '../support/test.js'

test.use({ storageState: path.join(dataDir, 'owner.json') })

const run = Date.now().toString(36).slice(-5)
const riderName = `Rider ${run}`

test('an order goes to a rider, is delivered, and the rider hands in the cash', async ({ page, browser }) => {
  const api = await adminApi()
  // the rider, with a fee of Rs. 150 for each delivery
  const phone = `0346 ${String(1_000_000 + Math.floor(Math.random() * 8_000_000))}`
  await api.post('/admin/delivery/people', { name: riderName, phone, kind: 'freelancer', fee: { amount: 15000, currency: 'PKR' }, active: true })

  // a customer orders, and staff confirm it (the way a call to the customer would)
  const customer = await (await browser.newContext()).newPage()
  await addToCart(customer, 'cotton-kurta', 'M')
  await customer.goto('/checkout')
  await fillCheckout(customer, { name: `Buyer ${run}` })
  await customer.getByRole('button', { name: 'Place order' }).click()
  const number = await orderNumber(customer)
  await customer.close()
  const found = await api.get(`/admin/orders?q=${encodeURIComponent(number)}`)
  const order = found.items.find((/** @type {{ orderNumber: string }} */ o) => o.orderNumber === number)
  const detail = await api.get(`/admin/orders/${order.id}`)
  await api.post(`/admin/orders/${order.id}/transitions`, { version: detail.version, to: 'confirmed', via: 'call' })

  // from the Orders list: choose the order, Assign to a rider
  await page.goto(`${urls.admin}/orders?q=${encodeURIComponent(number)}`)
  await page.getByRole('button', { name: /^To dispatch/ }).click() // the confirmed orders
  await page.getByRole('checkbox', { name: new RegExp(number) }).click()
  await page.getByRole('button', { name: 'Assign to a rider' }).click()
  const dialog = page.getByRole('dialog', { name: /Assign 1 order to a rider/ })
  await dialog.getByLabel(/^Delivery person/).selectOption({ label: riderName })
  await dialog.getByRole('button', { name: 'Assign' }).click()
  await expect(dialog.getByText(/Given to the rider: RUN-/).or(page.getByRole('dialog', { name: /Given to the rider: RUN-/ }))).toBeVisible()
  await page.getByRole('link', { name: 'Open the run' }).click()

  // the run: send it out; the order is dispatched and the rider owes the cash
  await expect(page.getByRole('heading', { name: /RUN-\d+/ })).toBeVisible()
  await expectNoViolations(page)
  await page.getByRole('button', { name: 'Send out' }).click()
  await expect(page.getByText('Out', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: `Actions for ${number}` }).click()
  await page.getByRole('menuitem', { name: 'Delivered, cash collected' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delivered' }).click()
  const receiptLink = page.getByRole('link', { name: /^Receipt RC-\d+$/ })
  await expect(receiptLink).toBeVisible()
  expect((await api.get(`/admin/orders/${order.id}`)).status).toBe('delivered')

  // the receipt on paper
  await receiptLink.click()
  await expect(page.getByText(/^RC-\d{6}$/).first()).toBeVisible()
  await expect(page.getByText(`Buyer ${run}`)).toBeVisible()
  await expectNoViolations(page)

  // the rider hands the cash in
  const people = await api.get('/admin/delivery/people')
  const rider = people.items.find((/** @type {{ name: string }} */ p) => p.name === riderName)
  expect(rider.balance.amount, 'the cash of the order less the fee of the delivery').toBeGreaterThan(0)
  await page.goto(`${urls.admin}/delivery/people/${rider.id}`)
  await expect(page.getByRole('region', { name: 'Balance' })).toContainText('Owes')
  await page.getByRole('button', { name: 'Record cash handed in' }).click()
  const cash = page.getByRole('dialog', { name: 'Cash handed in' })
  await cash.getByLabel(/^Amount/).fill(String(rider.balance.amount / 100))
  await cash.getByRole('button', { name: 'Record and make receipt' }).click()
  await expect(page.getByRole('region', { name: 'Balance' })).toContainText('Square')
  const ledger = page.getByRole('table', { name: /Ledger of/ })
  await expect(ledger.getByText('Cash to collect')).toBeVisible()
  await expect(ledger.getByText('Fee earned')).toBeVisible()
  await expect(ledger.getByText('Cash handed in')).toBeVisible()
  await expectNoViolations(page)

  // the receipts list shows both receipts of the rider
  await page.goto(`${urls.admin}/delivery/receipts`)
  await expect(page.getByRole('cell', { name: /^RC-\d{6}$/ }).first()).toBeVisible()
  await expect(page.getByRole('cell', { name: /^DP-\d{6}$/ }).first()).toBeVisible()
  await api.dispose()
})
