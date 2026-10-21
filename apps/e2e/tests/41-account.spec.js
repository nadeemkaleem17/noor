// Customer accounts (plan/10-api/11-account.md): someone registers with a mobile number, an order placed while signed in is on their account, an earlier guest order is added with its
// number, signing out and in works, and staff see when they registered. Also: registering a number does not show that number's earlier orders.
import path from 'node:path'
import { dataDir, urls } from '../env.mjs'
import { adminApi } from '../support/api.js'
import { expectNoViolations } from '../support/axe.js'
import { uniquePhone } from '../support/buyer.js'
import { addToCart, fillCheckout, orderNumber } from '../support/shop.js'
import { expect, test } from '../support/test.js'

test.use({ storageState: path.join(dataDir, 'owner.json') })

const password = 'blue kettle 4417 sings'
const run = Date.now().toString(36).slice(-5)

test('a customer registers, orders while signed in, adds an earlier order, signs out and in; staff see the registration', async ({ page, browser }) => {
  const phone = uniquePhone()
  const name = `Account ${run}`
  const api = await adminApi()
  const customer = await (await browser.newContext()).newPage()

  // a guest order first, with this number
  await addToCart(customer, 'cotton-kurta', 'M')
  await customer.goto('/checkout')
  await fillCheckout(customer, { name, phone })
  await customer.getByRole('button', { name: 'Place order' }).click()
  const earlier = await orderNumber(customer)

  // registering: the form is checked, then the account opens, and it shows none of the earlier order
  await customer.goto('/account')
  await expect(customer).toHaveURL(/\/account\/login/) // not signed in
  await customer.getByRole('link', { name: 'Create an account' }).click()
  await expectNoViolations(customer)
  await customer.getByLabel('Your name').fill(name)
  await customer.getByLabel('Mobile number').fill(phone)
  await customer.getByLabel('Password').fill('short')
  await customer.getByRole('button', { name: 'Create the account' }).click()
  await expect(customer.getByText('Use at least 8 characters.').first()).toBeVisible()
  await customer.getByLabel('Password').fill(password)
  await customer.getByRole('button', { name: 'Create the account' }).click()
  await expect(customer).toHaveURL(/\/account$/)
  await expect(customer.getByRole('heading', { name: `Hello, ${name.split(' ')[0]}` })).toBeVisible()
  await expect(customer.getByText('No orders on this account yet.')).toBeVisible()
  await expect(customer.getByText(earlier)).toHaveCount(0)
  await expectNoViolations(customer)

  // add the earlier order with its number and phone
  await customer.getByText('Add an earlier order').click()
  await customer.getByLabel('Order number').fill(earlier)
  await customer.getByLabel('Mobile number').last().fill(phone)
  await customer.getByRole('button', { name: 'Add the order' }).click()
  await expect(customer.getByText('The order was added to your account.')).toBeVisible()
  await expect(customer.getByRole('link', { name: earlier })).toBeVisible()

  // an order placed while signed in is on the account without asking
  await addToCart(customer, 'cotton-kurta', 'M')
  await customer.goto('/checkout')
  await expect(customer.getByLabel('Full name')).toHaveValue(name) // offered from the account
  await fillCheckout(customer, { name, phone })
  await customer.getByRole('button', { name: 'Place order' }).click()
  const placed = await orderNumber(customer)
  await customer.goto('/account')
  await expect(customer.getByRole('link', { name: placed })).toBeVisible()

  // sign out: the account page needs a sign-in again; a wrong password is refused; the right one opens it
  await customer.getByRole('button', { name: 'Sign out' }).click()
  await customer.goto('/account')
  await expect(customer).toHaveURL(/\/account\/login/)
  await customer.getByLabel('Mobile number').fill(phone)
  await customer.getByLabel('Password').fill('not the password')
  await customer.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(customer.getByText('The number or the password is not right.')).toBeVisible()
  await customer.getByLabel('Password').fill(password)
  await customer.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(customer).toHaveURL(/\/account$/)
  await expect(customer.getByRole('link', { name: placed })).toBeVisible()
  await customer.close()

  // staff: registered, and the Registered-only filter
  const found = await api.get(`/admin/customers?q=${encodeURIComponent(name)}`)
  const row = found.items.find((/** @type {{ name: string }} */ c) => c.name === name)
  expect(row?.registeredAt).toBeTruthy()
  await page.goto(`${urls.admin}/customers/${row.id}`)
  const block = page.getByRole('region', { name: 'Account on the shop' })
  await expect(block.getByText('Registered')).toBeVisible()
  await expectNoViolations(page)
  await page.goto(`${urls.admin}/customers?registered=1&q=${encodeURIComponent(name)}`)
  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible()
  await api.dispose()
})
