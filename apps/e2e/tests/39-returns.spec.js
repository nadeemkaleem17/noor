// After-sale (plan/06-storefront/14-site-blueprint.md OR-07, RT-02 to RT-04): a delivered order offers a return or exchange, staff decide in the Returns queue,
// and the customer sees the decision on the order page. Also "Buy again".
import path from 'node:path'
import { dataDir, urls } from '../env.mjs'
import { adminApi } from '../support/api.js'
import { expectNoViolations } from '../support/axe.js'
import { addToCart, fillCheckout, orderNumber } from '../support/shop.js'
import { expect, test } from '../support/test.js'

test.use({ storageState: path.join(dataDir, 'owner.json') })

const run = Date.now().toString(36).slice(-5)

// REQ: OR-07, RT-02, RT-03, RT-04
test('a customer asks to exchange a delivered order, staff approve it, and the customer sees it; Buy again fills the bag', async ({ page, browser }) => {
  const api = await adminApi()
  try {
    // the shop takes requests for 7 days after delivery
    const store = await api.get('/admin/settings/store')
    await api.put('/admin/settings/store', { value: { ...store.value, policies: { ...store.value.policies, returnsDays: 7 } }, version: store.version })

    // an order that went all the way to delivery
    const customer = await (await browser.newContext()).newPage()
    await addToCart(customer, 'cotton-kurta', 'M')
    await customer.goto('/checkout')
    await fillCheckout(customer, { name: `Returner ${run}` })
    await customer.getByRole('button', { name: 'Place order' }).click()
    const number = await orderNumber(customer)
    const orderUrl = new URL(customer.url()).pathname
    const found = await api.get(`/admin/orders?q=${encodeURIComponent(number)}`)
    const order = found.items.find((/** @type {{ orderNumber: string }} */ o) => o.orderNumber === number)
    const courier = (await api.get('/admin/couriers')).items.find((/** @type {{ enabled: boolean }} */ c) => c.enabled)
    const step = async (/** @type {object} */ body) => {
      const now = await api.get(`/admin/orders/${order.id}`)
      await api.post(`/admin/orders/${order.id}/transitions`, { version: now.version, ...body })
    }
    await step({ to: 'confirmed', via: 'call' })
    await step({ to: 'dispatched', courierId: courier.id, trackingNumber: `T${run}` })
    await step({ to: 'delivered', cashReceived: true })

    // the customer's order page offers it; they ask for an exchange
    await customer.goto(orderUrl)
    await expect(customer.getByRole('heading', { name: 'Returns and exchanges' })).toBeVisible()
    await customer.getByText('Ask for a return or exchange').click()
    await expectNoViolations(customer)
    await customer.getByLabel('Exchange it').check()
    await customer.getByLabel('If you want an exchange: the size or colour you would like').fill('Size L')
    await customer.getByRole('button', { name: 'Send the request' }).click()
    await expect(customer.getByText(/Your request RR-\d+ was sent/)).toBeVisible()
    await expect(customer.getByText('Waiting for us')).toBeVisible()

    // staff see it in the queue and approve it with a pickup day
    await page.goto(`${urls.admin}/returns`)
    const card = page.getByRole('listitem').filter({ hasText: number })
    await expect(card.getByText('Wants instead: Size L')).toBeVisible()
    await expectNoViolations(page)
    await card.getByRole('button', { name: 'Approve' }).click()
    const dialog = page.getByRole('dialog', { name: /^Approve: RR-/ })
    await dialog.getByLabel(/^Note for the customer/).fill('Send it back unwashed')
    await dialog.getByLabel(/^Pickup day/).fill('2026-12-01')
    await dialog.getByRole('button', { name: 'Approve' }).click()
    await expect(card).toHaveCount(0) // it left the Waiting tab

    // the customer sees the decision
    await customer.reload()
    await expect(customer.getByText('Approved')).toBeVisible()
    await expect(customer.getByText('Our note: Send it back unwashed')).toBeVisible()
    await expect(customer.getByText(/^Pickup on /)).toBeVisible()

    // Buy again puts the lines back in the bag and opens it
    await customer.getByRole('button', { name: 'Buy again' }).click()
    await expect(customer).toHaveURL(/\/cart$/)
    await expect(customer.getByText(/Cotton Kurta/i).first()).toBeVisible()
    await customer.close()
  } finally {
    const store = await api.get('/admin/settings/store')
    const policies = { ...store.value.policies }
    delete policies.returnsDays
    await api.put('/admin/settings/store', { value: { ...store.value, policies }, version: store.version }).catch(() => undefined)
    await api.dispose()
  }
})
