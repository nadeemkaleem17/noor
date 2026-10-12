import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, renderApp, resetApp } from '@/test/app'
import { countsAnswer, lookupsAnswer, oid, rowFixture } from '@/test/sales-data'

afterEach(resetApp)

const page = (/** @type {unknown[]} */ items) => json(200, { items, total: items.length, page: 1, size: 50 })
const perms = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'orders:read', 'orders:confirm', 'orders:dispatch', 'orders:deliver', 'orders:export', 'orders:edit', 'customers:read'])
/** @param {Record<string, (r: { body: any; headers: Headers; url: URL }) => Response>} [more] */
const session = (more = {}) => ({
  'GET /admin/me': () => json(200, me({ permissions: perms })),
  'GET /admin/orders/counts': () => json(200, countsAnswer()),
  'GET /admin/orders/lookups': () => json(200, lookupsAnswer()),
  ...more,
})

describe('order list (plan/07-admin/05-orders.md section 2)', () => {
  it('starts on the "To confirm" tab, with the count of each tab, and shows the customer, city, total and age', async () => {
    /** @type {string[]} */
    const asked = []
    fakeApi(session({ 'GET /admin/orders': ({ url }) => (asked.push(url.search), page([rowFixture({ riskMarkers: ['repeat_customer'] })])) }))
    renderApp('/orders')
    expect(await screen.findByRole('link', { name: /^RB-10458/ })).toBeTruthy()
    expect(asked[0]).toContain('status=pending_confirmation')
    const tabs = screen.getByRole('navigation', { name: 'Order status' })
    expect(within(tabs).getByRole('button', { name: /To confirm\s*4/ }).getAttribute('aria-pressed')).toBe('true')
    expect(within(tabs).getByRole('button', { name: /To dispatch\s*2/ })).toBeTruthy()
    expect(within(tabs).getByRole('button', { name: /Cancelled \/ returned\s*2/ })).toBeTruthy()
    expect(within(tabs).queryByRole('button', { name: /Awaiting payment/ })).toBeNull() // no order waits for a prepaid payment
    expect(screen.getByText('Ayesha Khan')).toBeTruthy()
    expect(screen.getByText('Repeat customer')).toBeTruthy()
    expect(within(screen.getByRole('table')).getByText('Lahore')).toBeTruthy()
    expect(screen.getByText(/Rs\.? ?10,240/)).toBeTruthy()
  })

  it('a tab is a status filter in the address, and "All" asks for every status', async () => {
    /** @type {string[]} */
    const asked = []
    fakeApi(session({ 'GET /admin/orders': ({ url }) => (asked.push(url.searchParams.get('status') ?? ''), page([rowFixture()])) }))
    const { user, router } = renderApp('/orders')
    await screen.findByRole('link', { name: /^RB-10458/ })
    await user.click(screen.getByRole('button', { name: /To dispatch/ }))
    await waitFor(() => expect(asked.at(-1)).toBe('confirmed'))
    expect(router.state.location.search).toContain('status=confirmed')
    await user.click(screen.getByRole('button', { name: /^All/ }))
    await waitFor(() => expect(asked.at(-1)).toBe('pending,pending_confirmation,confirmed,dispatched,delivered,cancelled,returned'))
  })

  it('shows the "Awaiting payment" tab once an order is waiting for a prepaid payment', async () => {
    fakeApi(session({ 'GET /admin/orders/counts': () => json(200, countsAnswer({ pending: 3 })), 'GET /admin/orders': () => page([rowFixture()]) }))
    renderApp('/orders')
    expect(await screen.findByRole('button', { name: /Awaiting payment\s*3/ })).toBeTruthy()
  })

  it('does not show a copy button for a masked phone number', async () => {
    fakeApi(session({ 'GET /admin/orders': () => page([rowFixture({ customerPhone: '0300 ••••567' })]) }))
    renderApp('/orders')
    await screen.findByRole('link', { name: /^RB-10458/ })
    expect(screen.queryByRole('button', { name: /^Copy/ })).toBeNull()
  })

  it('bulk confirm asks how the customers were reached and sends the selected orders once; the failures are listed', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(
      session({
        'GET /admin/orders': () => page([rowFixture(), rowFixture({ id: oid.line1, orderNumber: 'RB-10459', customerName: 'Sana Malik' })]),
        'POST /admin/orders/bulk': ({ body }) => {
          sent = body
          return json(200, { succeeded: [oid.order], failed: [{ id: oid.line1, code: 'action_not_allowed' }] })
        },
      }),
    )
    const { user } = renderApp('/orders')
    await screen.findByRole('link', { name: /^RB-10458/ })
    await user.click(screen.getByRole('checkbox', { name: 'Select this page' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Confirm 2 orders')).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Confirm orders' }))
    await waitFor(() => expect(sent).toEqual({ ids: [oid.order, oid.line1], action: 'confirm', params: { via: 'call' } }))
    expect(await screen.findByText('1 done, 1 failed')).toBeTruthy()
  })

  it('bulk dispatch reads pasted tracking numbers, one order per line, and refuses a line it cannot read', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(
      session({
        'GET /admin/orders': () => page([rowFixture({ status: 'confirmed' })]),
        'POST /admin/orders/bulk': ({ body }) => {
          sent = body
          return json(200, { succeeded: [oid.order], failed: [] })
        },
      }),
    )
    const { user } = renderApp('/orders?status=confirmed')
    await screen.findByRole('link', { name: /^RB-10458/ })
    await user.click(screen.getByRole('checkbox', { name: 'Select RB-10458' }))
    await user.click(await screen.findByRole('button', { name: 'Mark dispatched' }))
    const dialog = await screen.findByRole('dialog')
    await user.selectOptions(await within(dialog).findByRole('combobox', { name: /Courier/ }), oid.courier)
    const box = within(dialog).getByRole('textbox', { name: /Tracking numbers/ })
    await user.type(box, 'not a line')
    expect(within(dialog).getByText(/Cannot read: not a line/)).toBeTruthy()
    await user.clear(box)
    await user.type(box, 'RB-10458, TCS-77')
    await user.click(within(dialog).getByRole('button', { name: 'Mark dispatched' }))
    await waitFor(() => expect(sent).toEqual({ ids: [oid.order], action: 'dispatch', params: { courierId: oid.courier, tracking: [{ orderNumber: 'RB-10458', trackingNumber: 'TCS-77' }] } }))
  })

  it('backing out of a bulk question does nothing and says nothing', async () => {
    let calls = 0
    fakeApi(session({ 'GET /admin/orders': () => page([rowFixture()]), 'POST /admin/orders/bulk': () => (calls++, json(200, { succeeded: [], failed: [] })) }))
    const { user } = renderApp('/orders')
    await screen.findByRole('link', { name: /^RB-10458/ })
    await user.click(screen.getByRole('checkbox', { name: 'Select RB-10458' }))
    await user.click(await screen.findByRole('button', { name: 'Mark delivered' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(calls).toBe(0)
    expect(screen.queryByText(/failed/)).toBeNull()
  })

  it('hides bulk actions and export from a role that may not use them', async () => {
    fakeApi({
      ...session({ 'GET /admin/orders': () => page([rowFixture()]) }),
      'GET /admin/me': () => json(200, me({ permissions: ['orders:read', 'customers:read'] })),
    })
    renderApp('/orders')
    await screen.findByRole('link', { name: /^RB-10458/ })
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'New order' })).toBeNull()
  })
})
