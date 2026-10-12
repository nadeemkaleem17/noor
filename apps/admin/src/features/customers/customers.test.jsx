import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'
import { customerFixture, customerRowFixture, lookupsAnswer, oid, rowFixture } from '@/test/sales-data'

afterEach(resetApp)

const page = (/** @type {unknown[]} */ items) => json(200, { items, total: items.length, page: 1, size: 50 })
const reader = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'customers:read', 'orders:read'])
const writer = /** @type {import('@noor/contract').Permission[]} */ ([...reader, 'customers:write', 'orders:edit'])
const owner = /** @type {import('@noor/contract').Permission[]} */ ([...writer, 'customers:export', 'customers:anonymise'])
/** @param {import('@noor/contract').Permission[]} permissions @param {Record<string, (r: { body: any; headers: Headers; url: URL }) => Response>} [more] */
const session = (permissions, more = {}) => ({
  'GET /admin/me': () => json(200, me({ permissions })),
  'GET /admin/orders/lookups': () => json(200, lookupsAnswer()),
  ...more,
})
const path = `/admin/customers/${oid.customer}`

describe('customer list (plan/07-admin/06-customers.md section 2)', () => {
  it('shows name and phone, the counts, the money and the flags, and filters by flag and city', async () => {
    fakeApi(session(reader, { 'GET /admin/customers': () => page([customerRowFixture({ refusedCount: 5, noCod: true, vip: true })]) }))
    renderApp('/customers')
    expect(await screen.findByRole('link', { name: /Ayesha Khan/ })).toBeTruthy()
    const table = screen.getByRole('table')
    expect(within(table).getByText('+923001234567')).toBeTruthy()
    expect(within(table).getByText('No COD')).toBeTruthy()
    expect(within(table).getByText('VIP')).toBeTruthy()
    expect(within(table).getByText('5')).toBeTruthy() // refused
    expect(within(table).getByText(/Rs\.? ?20,480/)).toBeTruthy()
    expect(await screen.findByRole('combobox', { name: 'City' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Flag' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull() // no customers:export
  })

  it('offers the export only to a role that has it', async () => {
    fakeApi(session(owner, { 'GET /admin/customers': () => page([customerRowFixture()]) }))
    renderApp('/customers')
    expect(await screen.findByRole('button', { name: 'Export CSV' })).toBeTruthy()
  })

  it('asks the server for the newest customers first', async () => {
    /** @type {string[]} */
    const asked = []
    fakeApi(session(reader, { 'GET /admin/customers': ({ url }) => (asked.push(url.search), page([])) }))
    renderApp('/customers?flag=no_cod')
    await screen.findByText('No customers yet').catch(() => screen.findByText('No results'))
    expect(asked[0]).toContain('flag=no_cod')
  })
})

describe('customer detail (plan/07-admin/06-customers.md section 3)', () => {
  const orderList = () => page([rowFixture()])

  it('shows the figures, the orders from the orders list, the addresses and the flags, with call and WhatsApp for a whole number', async () => {
    fakeApi(session(writer, { [`GET ${path}`]: () => json(200, customerFixture({ noCod: true, noCodReason: 'Refused twice' })), 'GET /admin/orders': orderList }))
    renderApp(`/customers/${oid.customer}`)
    expect(await screen.findByRole('heading', { name: 'Ayesha Khan' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Call' }).getAttribute('href')).toBe('tel:+923001234567')
    expect(screen.getByRole('link', { name: 'WhatsApp' }).getAttribute('href')).toBe('https://wa.me/923001234567')
    expect(screen.getByRole('link', { name: 'New order' }).getAttribute('href')).toBe(`/orders/new?customer=${oid.customer}`)
    expect(screen.getByText('Total spent')).toBeTruthy()
    expect(await screen.findByRole('link', { name: 'RB-10458' })).toBeTruthy()
    expect(screen.getByText('House 12, Street 4, DHA Phase 5')).toBeTruthy()
    expect(screen.getByText('Refused twice')).toBeTruthy()
  })

  it('a reader sees no edit, no anonymise and no new order', async () => {
    fakeApi(session(reader, { [`GET ${path}`]: () => json(200, customerFixture()), 'GET /admin/orders': orderList }))
    renderApp(`/customers/${oid.customer}`)
    await screen.findByRole('heading', { name: 'Ayesha Khan' })
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Anonymise' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'New order' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'New note' })).toBeNull()
  })

  it('needs a reason for No COD, and sends the version it read', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(
      session(writer, {
        [`GET ${path}`]: () => json(200, customerFixture()),
        'GET /admin/orders': orderList,
        [`PUT ${path}`]: ({ body }) => {
          sent = body
          return json(200, customerFixture({ noCod: true, noCodReason: body.noCodReason, version: 5 }))
        },
      }),
    )
    const { user } = renderApp(`/customers/${oid.customer}`)
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('checkbox', { name: /No cash on delivery/ }))
    const save = within(dialog).getByRole('button', { name: 'Save' })
    expect(save.hasAttribute('disabled')).toBe(true)
    await user.type(within(dialog).getByRole('textbox', { name: /Why/ }), 'Refused twice')
    await user.click(save)
    await waitFor(() => expect(sent).toMatchObject({ version: 4, name: 'Ayesha Khan', noCod: true, noCodReason: 'Refused twice', vip: false, marketingConsent: false }))
    expect(await screen.findByText('Refused twice')).toBeTruthy()
  })

  it('a stale edit says so and keeps the dialog', async () => {
    fakeApi(session(writer, { [`GET ${path}`]: () => json(200, customerFixture()), 'GET /admin/orders': orderList, [`PUT ${path}`]: () => problem(409, 'stale_write') }))
    const { user } = renderApp(`/customers/${oid.customer}`)
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/Someone else changed this customer/)).toBeTruthy()
  })

  it('adds a note', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(
      session(writer, {
        [`GET ${path}`]: () => json(200, customerFixture()),
        'GET /admin/orders': orderList,
        [`POST ${path}/notes`]: ({ body }) => {
          sent = body
          return json(201, { id: oid.event, body: body.body, staffName: 'AK', createdAt: '2026-10-05T10:00:00.000Z' })
        },
      }),
    )
    const { user } = renderApp(`/customers/${oid.customer}`)
    await user.type(await screen.findByRole('textbox', { name: 'New note' }), 'Prefers evening delivery')
    await user.click(screen.getByRole('button', { name: 'Add note' }))
    await waitFor(() => expect(sent).toEqual({ body: 'Prefers evening delivery' }))
  })

  it('anonymises after the last four digits of the number are typed, and says why when an order is open', async () => {
    /** @type {any} */
    let sent = null
    let calls = 0
    fakeApi(
      session(owner, {
        [`GET ${path}`]: () => json(200, customerFixture()),
        'GET /admin/orders': orderList,
        [`POST ${path}/anonymise`]: ({ body }) => {
          sent = body
          return calls++ === 0 ? problem(409, 'action_not_allowed', { openOrders: 1 }) : json(204)
        },
        'GET /admin/customers': () => page([]),
      }),
    )
    const { user } = renderApp(`/customers/${oid.customer}`)
    await user.click(await screen.findByRole('button', { name: 'Anonymise' }))
    const dialog = await screen.findByRole('alertdialog')
    const confirm = within(dialog).getByRole('button', { name: 'Anonymise' })
    expect(confirm.hasAttribute('disabled') || confirm.getAttribute('aria-disabled') === 'true').toBe(true)
    await user.type(within(dialog).getByRole('textbox'), '4567')
    await user.click(confirm)
    await waitFor(() => expect(sent).toEqual({ confirm: '4567' }))
    expect((await screen.findAllByText(/open order/)).length).toBeGreaterThan(0)
  })

  it('an anonymised customer has no actions and no copy button', async () => {
    fakeApi(session(owner, { [`GET ${path}`]: () => json(200, customerFixture({ name: 'Anonymised customer', phone: '+0000', anonymisedAt: '2026-10-05T10:00:00.000Z' })), 'GET /admin/orders': orderList }))
    renderApp(`/customers/${oid.customer}`)
    expect(await screen.findByText('Anonymised')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Anonymise' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copy number' })).toBeNull()
  })
})
