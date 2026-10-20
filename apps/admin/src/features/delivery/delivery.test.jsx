import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, renderApp, resetApp } from '@/test/app'
import { rowFixture } from '@/test/sales-data'

afterEach(resetApp)

const id = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-0000000009${String(n).padStart(2, '0')}`
const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })
const person = (/** @type {object} */ over = {}) => ({ id: id(1), name: 'Bilal Rider', phone: '+923012223344', kind: 'freelancer', fee: money(20000), active: true, balance: money(0), ordersOut: 0, version: 1, ...over })
const shop = { name: 'Rubaya', address: 'Mall Road, Lahore', phone: '042 111' }
const line = (/** @type {number} */ n, /** @type {object} */ over = {}) => ({
  id: id(10 + n), orderId: id(20 + n), orderNumber: `RB-${10000 + n}`, customerName: `Customer ${n}`, phone: '+923001234567', city: 'Lahore', address: 'House 12, Gulberg',
  status: 'assigned', cashDue: money(500000), collected: money(0), ...over,
})
const run = (/** @type {object} */ over = {}, assignments = [line(1), line(2)]) => ({
  id: id(30), number: 'RUN-0001', personId: id(1), personName: 'Bilal Rider', runDate: '2026-10-20', status: 'open', orders: assignments.length, cashDue: money(1000000), collected: money(0),
  createdAt: '2026-10-20T08:00:00.000Z', shop, assignments, ...over,
})
const all = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'deliveries:read', 'deliveries:assign', 'ledger:read', 'ledger:write', 'receipts:void', 'orders:read'])
const session = (/** @type {import('@noor/contract').Permission[]} */ permissions = all, /** @type {Record<string, (r: { body: any; headers: Headers; url: URL }) => Response>} */ more = {}) => ({
  'GET /admin/me': () => json(200, me({ permissions })),
  'GET /admin/delivery/people': () => json(200, { items: [person({ balance: money(1500000), ordersOut: 3 }), person({ id: id(2), name: 'Old rider', active: false })] }),
  ...more,
})

describe('delivery people', () => {
  it('lists who delivers with the cash they hold, and what is owed to them in words', async () => {
    fakeApi(session())
    renderApp('/delivery/people')
    const table = await screen.findByRole('table', { name: 'Delivery people' })
    expect(within(table).getByText(/Owes Rs\.? ?15,000/)).toBeTruthy()
    expect(within(table).getByText('Square')).toBeTruthy()
    expect(within(table).getByText('Not active')).toBeTruthy()
    expect(within(table).getByRole('link', { name: 'Bilal Rider' }).getAttribute('href')).toBe(`/delivery/people/${id(1)}`)
  })

  it('adds a person with the fee and sends the phone as typed', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(session(all, { 'POST /admin/delivery/people': ({ body }) => ((sent = body), json(201, person({ ...body, id: id(3), balance: money(0), ordersOut: 0, version: 1 }))) }))
    const { user } = renderApp('/delivery/people')
    await user.click(await screen.findByRole('button', { name: 'New person' }))
    const drawer = await screen.findByRole('dialog', { name: 'New delivery person' })
    await user.type(within(drawer).getByLabelText(/^Name/), 'Imran')
    await user.type(within(drawer).getByLabelText(/^Mobile number/), '0300 5551234')
    await user.type(within(drawer).getByLabelText(/^Fee for each delivered order/), '150')
    await user.click(within(drawer).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent).toMatchObject({ name: 'Imran', phone: '0300 5551234', kind: 'freelancer', fee: { amount: 15000, currency: 'PKR' }, active: true })
  })

  it('gives a reader no way to add or edit', async () => {
    fakeApi(session(['dashboard:read', 'deliveries:read']))
    renderApp('/delivery/people')
    await screen.findByRole('table', { name: 'Delivery people' })
    expect(screen.queryByRole('button', { name: 'New person' })).toBeNull()
  })
})

describe('the ledger of a person', () => {
  const statement = (/** @type {object} */ over = {}) => ({
    person: person({ balance: money(480000) }), opening: money(0), closing: money(480000),
    entries: [
      { id: id(41), kind: 'cash_due', amount: money(500000), balance: money(500000), orderNumber: 'RB-10001', runNumber: 'RUN-0001', createdAt: '2026-10-20T08:00:00.000Z' },
      { id: id(42), kind: 'fee', amount: money(-20000), balance: money(480000), orderNumber: 'RB-10001', note: 'Fee for the delivery', createdAt: '2026-10-20T10:00:00.000Z' },
    ],
    ...over,
  })

  it('shows the running balance of every line and the balance now', async () => {
    fakeApi(session(all, { [`GET /admin/delivery/people/${id(1)}/ledger`]: () => json(200, statement()) }))
    renderApp(`/delivery/people/${id(1)}`)
    const table = await screen.findByRole('table', { name: /Ledger of/ })
    expect(within(table).getByText('Cash to collect')).toBeTruthy()
    expect(within(table).getByText('Fee earned')).toBeTruthy()
    expect(within(table).getByText('Balance now')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Balance' }).textContent).toMatch(/Owes Rs\s?4,800/)
  })

  it('records cash handed in as a positive amount and makes the receipt', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(session(all, {
      [`GET /admin/delivery/people/${id(1)}/ledger`]: () => json(200, statement()),
      [`POST /admin/delivery/people/${id(1)}/deposit`]: ({ body }) => ((sent = body), json(201, { id: id(50), number: 'DP-000001', kind: 'deposit', personId: id(1), personName: 'Bilal Rider', amount: money(body.amount), status: 'issued', issuedAt: '2026-10-20T12:00:00.000Z', shop })),
    }))
    const { user } = renderApp(`/delivery/people/${id(1)}`)
    await user.click(await screen.findByRole('button', { name: 'Record cash handed in' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cash handed in' })
    expect(within(dialog).getByRole('button', { name: 'Record and make receipt' }).hasAttribute('disabled')).toBe(true)
    await user.type(within(dialog).getByLabelText(/^Amount/), '2500')
    await user.type(within(dialog).getByLabelText('Note'), 'Evening hand-in')
    await user.click(within(dialog).getByRole('button', { name: 'Record and make receipt' }))
    await waitFor(() => expect(sent).toEqual({ amount: 250000, note: 'Evening hand-in' }))
    expect((await screen.findAllByText('Receipt DP-000001 made')).length).toBeGreaterThan(0)
  })

  it('needs a reason for an adjustment, and sends it negative when the person owes less', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(session(all, {
      [`GET /admin/delivery/people/${id(1)}/ledger`]: () => json(200, statement()),
      [`POST /admin/delivery/people/${id(1)}/adjust`]: ({ body }) => ((sent = body), json(200, statement())),
    }))
    const { user } = renderApp(`/delivery/people/${id(1)}`)
    await user.click(await screen.findByRole('button', { name: 'Adjustment' }))
    const dialog = await screen.findByRole('dialog', { name: 'Adjustment' })
    await user.type(within(dialog).getByLabelText(/^Amount/), '50')
    expect(within(dialog).getByRole('button', { name: 'Add to the ledger' }).hasAttribute('disabled')).toBe(true) // no reason yet
    await user.click(within(dialog).getByLabelText('The person owes the shop less'))
    await user.type(within(dialog).getByLabelText(/^Why/), 'Change refunded to a customer')
    await user.click(within(dialog).getByRole('button', { name: 'Add to the ledger' }))
    await waitFor(() => expect(sent).toEqual({ amount: -5000, note: 'Change refunded to a customer' }))
  })

  it('has no buttons for someone who may only read the ledger', async () => {
    fakeApi(session(['dashboard:read', 'ledger:read'], { [`GET /admin/delivery/people/${id(1)}/ledger`]: () => json(200, statement()) }))
    renderApp(`/delivery/people/${id(1)}`)
    await screen.findByRole('table', { name: /Ledger of/ })
    expect(screen.queryByRole('button', { name: 'Record cash handed in' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Adjustment' })).toBeNull()
  })
})

describe('a run', () => {
  it('sends the run out and then offers what can happen to each order', async () => {
    let current = run()
    fakeApi(session(all, {
      [`GET /admin/delivery/runs/${id(30)}`]: () => json(200, current),
      [`POST /admin/delivery/runs/${id(30)}/send-out`]: () => ((current = run({ status: 'out' }, [line(1, { status: 'out' }), line(2, { status: 'out' })])), json(200, current)),
    }))
    const { user } = renderApp(`/delivery/runs/${id(30)}`)
    await screen.findByRole('heading', { name: /RUN-0001/ })
    expect(screen.getByText(/Nothing has left the shop yet/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Send out' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Send out' })).toBeNull())
    await user.click(await screen.findByRole('button', { name: 'Actions for RB-10001' }))
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['Delivered, cash collected', 'Could not deliver', 'Parcel back at the shop'])
    expect(screen.getByRole('button', { name: 'Close the run' }).hasAttribute('disabled')).toBe(true) // orders are still out
  })

  it('marks an order delivered after asking, and says the cash and the receipt', async () => {
    let current = run({ status: 'out' }, [line(1, { status: 'out' })])
    let delivered = false
    fakeApi(session(all, {
      [`GET /admin/delivery/runs/${id(30)}`]: () => json(200, current),
      [`POST /admin/delivery/assignments/${id(11)}/deliver`]: () => ((delivered = true), (current = run({ status: 'out' }, [line(1, { status: 'delivered', collected: money(500000), receiptId: id(60), receiptNumber: 'RC-000001' })])), json(200, current)),
    }))
    const { user } = renderApp(`/delivery/runs/${id(30)}`)
    await user.click(await screen.findByRole('button', { name: 'Actions for RB-10001' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delivered, cash collected' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/a customer receipt is made/)).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Delivered' }))
    await waitFor(() => expect(delivered).toBe(true))
    expect(await screen.findByRole('link', { name: 'Receipt RC-000001' })).toBeTruthy()
  })

  it('needs a reason when an order could not be delivered', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(session(all, {
      [`GET /admin/delivery/runs/${id(30)}`]: () => json(200, run({ status: 'out' }, [line(1, { status: 'out' })])),
      [`POST /admin/delivery/assignments/${id(11)}/fail`]: ({ body }) => ((sent = body), json(200, run({ status: 'out' }, [line(1, { status: 'failed', failReason: body.reason })]))),
    }))
    const { user } = renderApp(`/delivery/runs/${id(30)}`)
    await user.click(await screen.findByRole('button', { name: 'Actions for RB-10001' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Could not deliver' }))
    const dialog = await screen.findByRole('dialog', { name: /could not be delivered/ })
    expect(within(dialog).getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true)
    await user.type(within(dialog).getByLabelText(/^What happened/), 'Phone off')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sent).toEqual({ reason: 'Phone off' }))
  })

  it('shows a reader the run and nothing to change it with', async () => {
    fakeApi(session(['dashboard:read', 'deliveries:read'], { [`GET /admin/delivery/runs/${id(30)}`]: () => json(200, run({ status: 'out' }, [line(1, { status: 'out' })])) }))
    renderApp(`/delivery/runs/${id(30)}`)
    await screen.findByRole('heading', { name: /RUN-0001/ })
    expect(screen.queryByRole('button', { name: 'Send out' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Actions for RB-10001' })).toBeNull()
  })
})

describe('assigning from the orders list', () => {
  it('asks for a person and a day, sends the chosen orders, and names the ones that could not go', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(session([...all, 'orders:read'], {
      'GET /admin/orders': () => json(200, { items: [rowFixture({ status: 'confirmed' })], total: 1, page: 1, size: 50 }),
      'GET /admin/orders/counts': () => json(200, { all: 1, confirmed: 1 }),
      'POST /admin/delivery/assign': ({ body }) => ((sent = body), json(200, { assigned: [], skipped: [{ id: body.orderIds[0], code: 'not_assignable', detail: 'RB-10458 is pending confirmation: only confirmed orders can be given to a rider.' }] })),
    }))
    const { user } = renderApp('/orders')
    await user.click(await screen.findByRole('checkbox', { name: /Select / }))
    await user.click(await screen.findByRole('button', { name: 'Assign to a rider' }))
    const dialog = await screen.findByRole('dialog', { name: /Assign 1 order to a rider/ })
    await user.selectOptions(await within(dialog).findByLabelText(/^Delivery person/), id(1))
    await user.click(within(dialog).getByRole('button', { name: 'Assign' }))
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent).toMatchObject({ personId: id(1), orderIds: [expect.any(String)] })
    expect(await within(dialog).findByText(/only confirmed orders can be given to a rider/)).toBeTruthy()
  })
})

describe('receipts', () => {
  it('lists them and voids one with a reason', async () => {
    /** @type {any} */
    let sent = null
    const row = { id: id(70), number: 'DP-000001', kind: 'deposit', personId: id(1), personName: 'Bilal Rider', amount: money(100000), status: 'issued', issuedAt: '2026-10-20T12:00:00.000Z' }
    fakeApi(session(all, {
      'GET /admin/delivery/receipts': () => json(200, { items: [row], total: 1, page: 1, size: 50 }),
      [`POST /admin/delivery/receipts/${id(70)}/void`]: ({ body }) => ((sent = body), json(200, { ...row, status: 'void', voidReason: body.reason, shop })),
    }))
    const { user } = renderApp('/delivery/receipts')
    expect(await screen.findByText('DP-000001')).toBeTruthy()
    await user.click(await screen.findByRole('button', { name: /Actions for DP-000001|Row actions/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Void' }))
    const dialog = await screen.findByRole('dialog', { name: /Void DP-000001/ })
    await user.type(within(dialog).getByLabelText(/^Why/), 'Wrong amount')
    await user.click(within(dialog).getByRole('button', { name: 'Void the receipt' }))
    await waitFor(() => expect(sent).toEqual({ reason: 'Wrong amount' }))
  })
})
