import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'
import { customerFixture, customerRowFixture, lookupsAnswer, oid, orderFixture, pickProductFixture, pid, productRowFixture, quoteFixture } from '@/test/sales-data'

afterEach(resetApp)

const perms = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'orders:read', 'orders:edit', 'products:read', 'customers:read'])
/** @param {Record<string, (r: { body: any; headers: Headers; url: URL }) => Response>} [more] */
const session = (more = {}) => ({
  'GET /admin/me': () => json(200, me({ permissions: perms })),
  'GET /admin/orders/lookups': () => json(200, lookupsAnswer()),
  'GET /admin/customers/by-phone': () => json(200, {}),
  'GET /admin/products': () => json(200, { items: [productRowFixture()], total: 1, page: 1, size: 25 }),
  [`GET /admin/products/${pid.product}`]: () => json(200, pickProductFixture()),
  ...more,
})

/** @param {import('@testing-library/user-event').UserEvent} user */
async function addLawnSuit(user) {
  await user.type(await screen.findByRole('searchbox'), 'lawn')
  await user.click(await screen.findByRole('button', { name: /Lawn Suit/ }))
  await user.selectOptions(await screen.findByRole('combobox', { name: /Variant/ }), pid.variantM)
  await user.click(screen.getByRole('button', { name: 'Add to order' }))
}

describe('staff-created order (plan/07-admin/06-customers.md section 4)', () => {
  it('takes the customer, the items and the delivery, shows the server\'s totals, and creates the order with one idempotency key', async () => {
    /** @type {any} */
    let created = null
    /** @type {string | null} */
    let key = null
    /** @type {any[]} */
    const quotes = []
    fakeApi(
      session({
        'POST /admin/orders/quote': ({ body }) => (quotes.push(body), json(200, quoteFixture())),
        'POST /admin/orders': ({ body, headers }) => {
          created = body
          key = headers.get('idempotency-key')
          return json(201, orderFixture({ id: oid.order, channel: 'admin' }))
        },
        [`GET /admin/orders/${oid.order}`]: () => json(200, orderFixture()),
      }),
    )
    const { user, router } = renderApp('/orders/new')
    await user.type(await screen.findByRole('textbox', { name: /Mobile number/ }), '0300 1234567')
    await user.type(screen.getByRole('textbox', { name: /^Name/ }), 'Sana Malik')
    await addLawnSuit(user)
    await user.selectOptions(await screen.findByRole('combobox', { name: /City/ }), oid.city)
    await user.type(screen.getByRole('textbox', { name: /Address/ }), 'House 12, Street 4, DHA Phase 5')
    expect(await screen.findByText(/Rs\.? ?7,240/)).toBeTruthy() // the server's total, not ours
    expect(quotes.at(-1)).toMatchObject({ cityId: oid.city, lines: [{ variantId: pid.variantM, quantity: 1 }], phone: '+923001234567' })
    expect(JSON.stringify(quotes.at(-1))).not.toMatch(/price|discount|total/i) // the screen sends no money
    const create = screen.getByRole('button', { name: 'Create order' })
    await waitFor(() => expect(create.hasAttribute('disabled')).toBe(false))
    await user.click(screen.getByRole('checkbox', { name: /confirmed on this call/ }))
    await user.click(create)
    await waitFor(() => expect(created).toMatchObject({
      customer: { name: 'Sana Malik', phone: '+923001234567' },
      shippingAddress: { cityId: oid.city, address: 'House 12, Street 4, DHA Phase 5' },
      shippingMethodId: pid.method,
      paymentMethod: 'cod',
      lines: [{ variantId: pid.variantM, quantity: 1 }],
      confirmedOnCall: true,
    }))
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
    expect(JSON.stringify(created)).not.toMatch(/expectedTotal/)
    await waitFor(() => expect(router.state.location.pathname).toBe(`/orders/${oid.order}`))
  })

  it('keeps Create order off until the customer, an item, the city and a full address are there', async () => {
    fakeApi(session({ 'POST /admin/orders/quote': () => json(200, quoteFixture()) }))
    const { user } = renderApp('/orders/new')
    const create = await screen.findByRole('button', { name: 'Create order' })
    expect(create.hasAttribute('disabled')).toBe(true)
    await user.type(screen.getByRole('textbox', { name: /Mobile number/ }), '12345')
    expect(await screen.findByText(/Enter a Pakistani mobile number/)).toBeTruthy()
    expect(create.hasAttribute('disabled')).toBe(true)
  })

  it('names a customer already on file for the number, with a No COD warning, and offers their name', async () => {
    fakeApi(session({ 'GET /admin/customers/by-phone': () => json(200, { customer: customerRowFixture({ name: 'Ayesha Khan', noCod: true }) }) }))
    const { user } = renderApp('/orders/new')
    await user.type(await screen.findByRole('textbox', { name: /Mobile number/ }), '0300 1234567')
    expect(await screen.findByText(/A customer with this number is on file/)).toBeTruthy()
    expect(screen.getByText(/No cash on delivery for this number/)).toBeTruthy()
    await user.type(screen.getByRole('textbox', { name: /^Name/ }), 'Aisha')
    await user.click(await screen.findByRole('button', { name: 'Use this name' }))
    expect((/** @type {HTMLInputElement} */ (screen.getByRole('textbox', { name: /^Name/ }))).value).toBe('Ayesha Khan')
  })

  it('starts from a customer on file: name and number are filled in', async () => {
    fakeApi(session({ [`GET /admin/customers/${oid.customer}`]: () => json(200, customerFixture()) }))
    renderApp(`/orders/new?customer=${oid.customer}`)
    await waitFor(() => expect((/** @type {HTMLInputElement} */ (screen.getByRole('textbox', { name: /^Name/ }))).value).toBe('Ayesha Khan'))
    expect((/** @type {HTMLInputElement} */ (screen.getByRole('textbox', { name: /Mobile number/ }))).value).toBe('03001234567')
  })

  it('does not take a sold-out variant for granted, and will not add a bundle', async () => {
    fakeApi(session({ [`GET /admin/products/${pid.product}`]: () => json(200, pickProductFixture({ kind: 'bundle' })) }))
    const { user } = renderApp('/orders/new')
    await user.type(await screen.findByRole('searchbox'), 'lawn')
    await user.click(await screen.findByRole('button', { name: /Lawn Suit/ }))
    expect(await screen.findByText(/A bundle needs a choice for each part/)).toBeTruthy()
    await user.selectOptions(screen.getByRole('combobox', { name: /Variant/ }), pid.variantM)
    expect(screen.getByRole('button', { name: 'Add to order' }).hasAttribute('disabled')).toBe(true)
  })

  it('asks for the measurements of a made-to-measure product and sends them as the customization', async () => {
    /** @type {any[]} */
    const quotes = []
    fakeApi(
      session({
        [`GET /admin/products/${pid.product}`]: () => json(200, pickProductFixture({ customSizeSchemaId: pid.schema })),
        [`GET /form-schemas/${pid.schema}`]: () => json(200, { id: pid.schema, title: 'Your measurements', fields: [{ key: 'bust', label: 'Bust', type: 'number', required: true, unit: 'in' }], allowNotes: true }),
        'POST /admin/orders/quote': ({ body }) => (quotes.push(body), json(200, quoteFixture())),
      }),
    )
    const { user } = renderApp('/orders/new')
    await user.type(await screen.findByRole('searchbox'), 'lawn')
    await user.click(await screen.findByRole('button', { name: /Lawn Suit/ }))
    await user.selectOptions(await screen.findByRole('combobox', { name: /Variant/ }), pid.variantM)
    const add = await screen.findByRole('button', { name: 'Add to order' })
    await screen.findByText('Your measurements')
    expect(add.hasAttribute('disabled')).toBe(true) // the bust is required
    await user.type(screen.getByRole('spinbutton', { name: /Bust/ }), '36')
    await user.click(add)
    await user.selectOptions(await screen.findByRole('combobox', { name: /City/ }), oid.city)
    await waitFor(() => expect(quotes.at(-1)?.lines[0]).toMatchObject({ variantId: pid.variantM, customization: { measurements: { bust: 36 } } }))
  })

  it('shows the server\'s refusal when the order cannot be created', async () => {
    fakeApi(session({ 'POST /admin/orders/quote': () => json(200, quoteFixture()), 'POST /admin/orders': () => problem(409, 'insufficient_stock') }))
    const { user } = renderApp('/orders/new')
    await user.type(await screen.findByRole('textbox', { name: /Mobile number/ }), '0300 1234567')
    await user.type(screen.getByRole('textbox', { name: /^Name/ }), 'Sana Malik')
    await addLawnSuit(user)
    await user.selectOptions(await screen.findByRole('combobox', { name: /City/ }), oid.city)
    await user.type(screen.getByRole('textbox', { name: /Address/ }), 'House 12, Street 4, DHA Phase 5')
    const create = screen.getByRole('button', { name: 'Create order' })
    await waitFor(() => expect(create.hasAttribute('disabled')).toBe(false))
    await user.click(create)
    expect(await screen.findByText(/not enough stock/)).toBeTruthy()
    expect(within(document.body).getByRole('button', { name: 'Create order' })).toBeTruthy()
  })
})
