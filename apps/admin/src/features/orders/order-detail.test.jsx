import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'
import { lookupsAnswer, oid, orderFixture } from './test-data'

afterEach(resetApp)

const path = `/admin/orders/${oid.order}`
const owner = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'orders:read', 'orders:note', 'orders:confirm', 'orders:edit', 'orders:dispatch', 'orders:deliver', 'orders:cancel', 'orders:return', 'orders:payments', 'customers:read'])
const support = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'orders:read', 'orders:note', 'customers:read'])

/** @param {import('@noor/contract').Permission[]} permissions @param {Record<string, (r: { body: any; headers: Headers; url: URL }) => Response>} [more] */
const session = (permissions, more = {}) => ({
  'GET /admin/me': () => json(200, me({ permissions })),
  'GET /admin/orders/lookups': () => json(200, lookupsAnswer()),
  ...more,
})

/** The labels the screen offers for an order: the primary button and everything in "More". @param {import('@testing-library/user-event').UserEvent} user */
async function offered(user) {
  const buttons = (await screen.findAllByRole('button')).map((b) => b.textContent?.trim() ?? '')
  const more = screen.queryByRole('button', { name: 'More' })
  /** @type {string[]} */
  let items = []
  if (more) {
    await user.click(more)
    items = (await screen.findAllByRole('menuitem')).map((i) => i.textContent?.trim() ?? '')
  }
  return { buttons, items }
}

describe('order detail (plan/07-admin/05-orders.md sections 3 and 4)', () => {
  it('offers exactly what the server allows for each status, and only what the role may do', async () => {
    const cases = [
      { status: 'pending_confirmation', allowed: ['confirm', 'edit_address', 'edit_items', 'cancel'], primary: 'Confirm order', more: ['Edit address or items', 'Cancel order'] },
      { status: 'confirmed', allowed: ['dispatch', 'revert_confirmation', 'edit_address', 'cancel'], primary: 'Mark dispatched', more: ['Revert to pending confirmation', 'Edit address or items', 'Cancel order'] },
      { status: 'dispatched', allowed: ['deliver', 'return', 'update_tracking'], primary: 'Mark delivered', more: ['Mark returned', 'Edit tracking'] },
      { status: 'delivered', allowed: ['return'], primary: null, more: ['Mark returned'] },
      { status: 'cancelled', allowed: [], primary: null, more: [] },
    ]
    for (const c of cases) {
      fakeApi(session(owner, { [`GET ${path}`]: () => json(200, orderFixture({ status: c.status, allowedActions: c.allowed })) }))
      const { user } = renderApp(`/orders/${oid.order}`)
      await screen.findByRole('heading', { name: 'RB-10458' })
      const { buttons, items } = await offered(user)
      if (c.primary) expect(buttons, c.status).toContain(c.primary)
      else expect(buttons.filter((b) => ['Confirm order', 'Mark dispatched', 'Mark delivered', 'Record payment'].includes(b)), c.status).toEqual([])
      expect(items.sort(), c.status).toEqual([...c.more].sort())
      resetApp()
      cleanup()
    }
  })

  it('a support user sees the order and may add notes, but is offered no change', async () => {
    fakeApi(session(support, { [`GET ${path}`]: () => json(200, orderFixture()) }))
    renderApp(`/orders/${oid.order}`)
    await screen.findByRole('heading', { name: 'RB-10458' })
    expect(screen.queryByRole('button', { name: 'Confirm order' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Add note' })).toBeTruthy()
  })

  it('confirms with how the customer was reached and the version it was read at, then shows the answer', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(
      session(owner, {
        [`GET ${path}`]: () => json(200, orderFixture()),
        [`POST ${path}/transitions`]: ({ body }) => {
          sent = body
          return json(200, orderFixture({ status: 'confirmed', version: 4, allowedActions: ['dispatch'] }))
        },
      }),
    )
    const { user } = renderApp(`/orders/${oid.order}`)
    await user.click(await screen.findByRole('button', { name: 'Confirm order' }))
    const dialog = await screen.findByRole('dialog')
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /Confirmed how/ }), 'whatsapp')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm order' }))
    await waitFor(() => expect(sent).toEqual({ version: 3, to: 'confirmed', via: 'whatsapp' }))
    expect(await screen.findByRole('button', { name: 'Mark dispatched' })).toBeTruthy()
    expect(screen.queryByText(/was updated/)).toBeNull() // our own change is not "someone else"
  })

  it('opened by the number on the screen, it still shows the order after a change (the cache is shared by number and id)', async () => {
    fakeApi(
      session(owner, {
        'GET /admin/orders/RB-10458': () => json(200, orderFixture()),
        [`POST ${path}/transitions`]: () => json(200, orderFixture({ status: 'confirmed', version: 4, allowedActions: ['dispatch'] })),
      }),
    )
    const { user } = renderApp('/orders/RB-10458')
    await user.click(await screen.findByRole('button', { name: 'Confirm order' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm order' }))
    expect(await screen.findByRole('button', { name: 'Mark dispatched' })).toBeTruthy()
  })

  it('does not let a deposit that is due and unpaid be confirmed', async () => {
    fakeApi(session(owner, { [`GET ${path}`]: () => json(200, orderFixture({ depositDue: { amount: 500000, currency: 'PKR' } })) }))
    const { user } = renderApp(`/orders/${oid.order}`)
    await user.click(await screen.findByRole('button', { name: 'Confirm order' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/deposit of Rs\.? ?5,000/i)).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Confirm order' }).hasAttribute('disabled') || within(dialog).getByRole('button', { name: 'Confirm order' }).getAttribute('aria-disabled') === 'true').toBe(true)
  })

  it('asks for an override reason to confirm cash on delivery for a flagged customer, and sends it', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(
      session(owner, {
        [`GET ${path}`]: () => json(200, orderFixture({ riskMarkers: ['cod_blocked'] })),
        [`POST ${path}/transitions`]: ({ body }) => {
          sent = body
          return json(200, orderFixture({ status: 'confirmed', version: 4 }))
        },
      }),
    )
    const { user } = renderApp(`/orders/${oid.order}`)
    await user.click(await screen.findByRole('button', { name: 'Confirm order' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByRole('textbox', { name: /Why confirm/ }), 'Known customer')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm order' }))
    await waitFor(() => expect(sent).toMatchObject({ to: 'confirmed', codOverrideReason: 'Known customer' }))
  })

  it('dispatch needs a courier and, for a courier that requires one, a tracking number', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(
      session(owner, {
        [`GET ${path}`]: () => json(200, orderFixture({ status: 'confirmed', allowedActions: ['dispatch'] })),
        [`POST ${path}/transitions`]: ({ body }) => {
          sent = body
          return json(200, orderFixture({ status: 'dispatched', version: 4, allowedActions: ['deliver'], courier: { id: oid.courier, name: 'TCS' }, trackingNumber: 'TCS-77' }))
        },
      }),
    )
    const { user } = renderApp(`/orders/${oid.order}`)
    await user.click(await screen.findByRole('button', { name: 'Mark dispatched' }))
    const dialog = await screen.findByRole('dialog')
    const submit = () => within(dialog).getByRole('button', { name: 'Mark dispatched' })
    expect(submit().hasAttribute('disabled')).toBe(true)
    await user.selectOptions(await within(dialog).findByRole('combobox', { name: /Courier/ }), oid.courier)
    expect(submit().hasAttribute('disabled')).toBe(true) // TCS needs a tracking number
    await user.type(within(dialog).getByRole('textbox', { name: /Tracking number/ }), 'TCS-77')
    await user.click(submit())
    await waitFor(() => expect(sent).toMatchObject({ version: 3, to: 'dispatched', courierId: oid.courier, trackingNumber: 'TCS-77' }))
  })

  it('cancel needs a reason, and money already taken must be acknowledged', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(
      session(owner, {
        [`GET ${path}`]: () => json(200, orderFixture({ paid: { amount: 500000, currency: 'PKR' }, paymentMethod: 'bank_transfer', paymentStatus: 'deposit_paid' })),
        [`POST ${path}/transitions`]: ({ body }) => {
          sent = body
          return json(200, orderFixture({ status: 'cancelled', version: 4, allowedActions: [] }))
        },
      }),
    )
    const { user } = renderApp(`/orders/${oid.order}`)
    await user.click(await screen.findByRole('button', { name: 'More' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Cancel order' }))
    const dialog = await screen.findByRole('dialog')
    const submit = within(dialog).getByRole('button', { name: 'Cancel order' })
    expect(submit.hasAttribute('disabled')).toBe(true)
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /Reason/ }), 'duplicate')
    expect(submit.hasAttribute('disabled')).toBe(true) // still owed back
    await user.click(within(dialog).getByRole('checkbox'))
    await user.click(submit)
    await waitFor(() => expect(sent).toEqual({ version: 3, to: 'cancelled', reason: 'duplicate', refundAcknowledged: true }))
  })

  it('a stale write shows the banner with the latest order, and nothing is overwritten', async () => {
    let reads = 0
    fakeApi(
      session(owner, {
        [`GET ${path}`]: () => json(200, reads++ === 0 ? orderFixture() : orderFixture({ status: 'confirmed', version: 4, allowedActions: ['dispatch'] })),
        [`POST ${path}/transitions`]: () => problem(409, 'stale_write'),
      }),
    )
    const { user } = renderApp(`/orders/${oid.order}`)
    await user.click(await screen.findByRole('button', { name: 'Confirm order' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm order' }))
    expect(await screen.findByText(/This order was updated: showing the latest/)).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Mark dispatched' })).toBeTruthy()
  })

  it('a return lists each open line with its quantity and whether it goes back on the shelf', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(
      session(owner, {
        [`GET ${path}`]: () => json(200, orderFixture({ status: 'dispatched', allowedActions: ['deliver', 'return', 'update_tracking'] })),
        [`POST ${path}/transitions`]: ({ body }) => {
          sent = body
          return json(200, orderFixture({ status: 'returned', version: 4, allowedActions: [] }))
        },
      }),
    )
    const { user } = renderApp(`/orders/${oid.order}`)
    await user.click(await screen.findByRole('button', { name: 'More' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Mark returned' }))
    const dialog = await screen.findByRole('dialog')
    // the second line is returned damaged: not put back on the shelf
    const boxes = within(dialog).getAllByRole('checkbox')
    await user.click(/** @type {HTMLElement} */ (boxes[1]))
    await user.click(within(dialog).getByRole('button', { name: 'Record return' }))
    await waitFor(() =>
      expect(sent).toMatchObject({
        version: 3,
        to: 'returned',
        returnType: 'refused_at_door',
        lines: [
          { lineId: oid.line1, quantity: 1, restock: true },
          { lineId: oid.line2, quantity: 2, restock: false },
        ],
      }),
    )
  })

  it('edits the address with the server\'s own old and new totals shown first', async () => {
    /** @type {any} */
    let saved = null
    fakeApi(
      session(owner, {
        [`GET ${path}`]: () => json(200, orderFixture()),
        [`POST ${path}/edit-preview`]: () =>
          json(200, {
            before: { subtotal: { amount: 999000, currency: 'PKR' }, discount: { amount: 0, currency: 'PKR' }, shippingFee: { amount: 25000, currency: 'PKR' }, total: { amount: 1024000, currency: 'PKR' }, depositDue: { amount: 0, currency: 'PKR' } },
            after: { subtotal: { amount: 999000, currency: 'PKR' }, discount: { amount: 0, currency: 'PKR' }, shippingFee: { amount: 35000, currency: 'PKR' }, total: { amount: 1034000, currency: 'PKR' }, depositDue: { amount: 0, currency: 'PKR' } },
            promoStillApplies: true,
            issues: [],
          }),
        [`PUT ${path}`]: ({ body }) => {
          saved = body
          return json(200, orderFixture({ version: 4 }))
        },
      }),
    )
    const { user } = renderApp(`/orders/${oid.order}`)
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Save changes' }).hasAttribute('disabled')).toBe(true) // nothing changed yet
    await user.selectOptions(await within(dialog).findByRole('combobox', { name: /City/ }), oid.city2)
    expect(await within(dialog).findByText(/Rs\.? ?10,340/)).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(saved).toMatchObject({ version: 3, shippingAddress: { cityId: oid.city2, address: 'House 12, Street 4, DHA Phase 5' } }))
  })

  it('adds a note as an event and shows the timeline of what happened', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(
      session(owner, {
        [`GET ${path}`]: () => json(200, orderFixture({ events: [{ id: oid.event, type: 'confirmation_attempt', actorType: 'staff', actorLabel: 'AK', data: { channel: 'call', outcome: 'no_answer' }, createdAt: '2026-10-05T11:00:00.000Z' }, { id: uuidFor(1), type: 'placed', actorType: 'storefront', createdAt: '2026-10-05T10:00:00.000Z' }] })),
        [`POST ${path}/notes`]: ({ body }) => {
          sent = body
          return json(201, { id: uuidFor(2), type: 'note', actorType: 'staff', actorLabel: 'AK', data: { body: body.body }, createdAt: '2026-10-05T12:00:00.000Z' })
        },
      }),
    )
    const { user } = renderApp(`/orders/${oid.order}`)
    expect(await screen.findByText('Order placed on the website')).toBeTruthy()
    expect(screen.getAllByText(/no answer/i).length).toBeGreaterThan(0)
    await user.type(screen.getByRole('textbox', { name: 'New note' }), 'Asked to deliver after 5pm')
    await user.click(screen.getByRole('button', { name: 'Add note' }))
    await waitFor(() => expect(sent).toEqual({ body: 'Asked to deliver after 5pm' }))
  })

  it('shows call and WhatsApp buttons for a whole number and none for a masked one', async () => {
    fakeApi(session(owner, { [`GET ${path}`]: () => json(200, orderFixture()) }))
    renderApp(`/orders/${oid.order}`)
    const call = await screen.findByRole('link', { name: 'Call' })
    expect(call.getAttribute('href')).toBe('tel:03001234567')
    expect(screen.getByRole('link', { name: 'WhatsApp' }).getAttribute('href')).toBe('https://wa.me/923001234567')
    resetApp()
    cleanup()
    fakeApi(session(support, { [`GET ${path}`]: () => json(200, orderFixture({ customer: { ...orderFixture().customer, name: 'Ayesha K.', phone: '0300 ••••567' } })) }))
    renderApp(`/orders/${oid.order}`)
    await screen.findByText('0300 ••••567')
    expect(screen.queryByRole('link', { name: 'Call' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).toBeNull()
  })
})

/** @param {number} n */
function uuidFor(n) {
  return `0194f1b2-7c3a-7000-8000-${String(950 + n).padStart(12, '0')}`
}
