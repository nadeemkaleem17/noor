import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'
import { pickProductFixture, pid, productRowFixture } from '@/test/sales-data'

afterEach(resetApp)

const uuid = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-${String(n).padStart(12, '0')}`
const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })
const ids = { eid: uuid(3001), used: uuid(3002), sorry: uuid(3003), cat: uuid(3004) }

/** One promo as the API gives it. @param {Record<string, unknown>} [over] */
const promoFixture = (over = {}) => ({
  id: ids.eid, code: 'EID10', type: 'percent', percent: 10, scope: 'all', excludeSaleItems: true, firstOrderOnly: false, perCustomerLimit: 1, enabled: true,
  status: 'active', usageCount: 0, used: false, targets: [], summary: '10% off everything. Once per customer.', version: 2, createdAt: '2026-10-01T00:00:00.000Z', ...over,
})
const page = (/** @type {unknown[]} */ items) => json(200, { items, total: items.length, page: 1, size: 50 })
const reader = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'promos:read'])
const writer = /** @type {import('@noor/contract').Permission[]} */ ([...reader, 'promos:write', 'catalog:read', 'products:read', 'orders:edit'])
const owner = /** @type {import('@noor/contract').Permission[]} */ ([...writer, 'promos:delete'])
/** @param {import('@noor/contract').Permission[]} permissions @param {Record<string, (r: { body: any; headers: Headers; url: URL }) => Response>} [more] */
const session = (permissions, more = {}) => ({
  'GET /admin/me': () => json(200, me({ permissions })),
  'GET /admin/categories': () => json(200, { items: [{ id: ids.cat, name: 'Lawn', handle: 'lawn', parentId: null, visible: true, attributes: [], sortOrder: 0, productCount: 3, version: 1, shop: { shown: true, liveProducts: 1 } }] }),
  ...more,
})
const list = () => page([promoFixture(), promoFixture({ id: ids.used, code: 'WELCOME', usageCount: 4, used: true, usageLimit: 100, status: 'expired', enabled: true, endsAt: '2026-09-30T00:00:00.000Z' }), promoFixture({ id: ids.sorry, code: 'SORRY', type: 'fixed', amount: money(50000), percent: undefined, status: 'disabled', enabled: false })])

describe('promo list (plan/07-admin/07-promos.md section 2)', () => {
  it('shows the code, the rule, the usage with a link to the orders, the window and the status the server worked out', async () => {
    fakeApi(session(owner, { 'GET /admin/promos': list }))
    renderApp('/promos')
    expect(await screen.findByText('EID10')).toBeTruthy()
    const table = screen.getByRole('table')
    expect(within(table).getAllByText('10% off').length).toBe(2)
    expect(within(table).getByText(/Rs\.? ?500\.?0* off/)).toBeTruthy()
    const used = within(table).getByRole('link', { name: '4 / 100' })
    expect(used.getAttribute('href')).toContain('/orders?promo=WELCOME&status=pending')
    expect(within(table).getByText('Expired')).toBeTruthy()
    expect(within(table).getByText('Disabled')).toBeTruthy()
    expect(within(table).getByText('Active')).toBeTruthy()
  })

  it('a reader sees the list and none of the actions', async () => {
    fakeApi(session(reader, { 'GET /admin/promos': list }))
    renderApp('/promos')
    await screen.findByText('EID10')
    expect(screen.queryByRole('button', { name: 'New code' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Actions for EID10' })).toBeNull()
  })

  it('switches a code off and on through the bulk call, one id', async () => {
    /** @type {any[]} */
    const sent = []
    fakeApi(session(writer, { 'GET /admin/promos': list, 'POST /admin/promos/bulk': ({ body }) => (sent.push(body), json(200, { succeeded: body.ids, failed: [] })) }))
    const { user } = renderApp('/promos')
    await user.click(await screen.findByRole('button', { name: 'Actions for EID10' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Switch off' }))
    await waitFor(() => expect(sent).toEqual([{ ids: [ids.eid], action: 'disable' }]))
    await user.click(await screen.findByRole('button', { name: 'Actions for SORRY' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Switch on' }))
    await waitFor(() => expect(sent.at(-1)).toEqual({ ids: [ids.sorry], action: 'enable' }))
  })

  it('deletes chosen codes together, and a role without promos:delete is not offered it', async () => {
    /** @type {any[]} */
    const sent = []
    fakeApi(session(owner, { 'GET /admin/promos': list, 'POST /admin/promos/bulk-delete': ({ body }) => (sent.push(body), json(200, { succeeded: body.ids, failed: [] })) }))
    const { user } = renderApp('/promos')
    await user.click(await screen.findByRole('checkbox', { name: /Select EID10/ }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(sent).toEqual([{ ids: [ids.eid] }]))
  })

  it('has no bulk Delete for a role that cannot delete promos', async () => {
    fakeApi(session(writer, { 'GET /admin/promos': list }))
    const { user } = renderApp('/promos')
    await user.click(await screen.findByRole('checkbox', { name: /Select EID10/ }))
    await screen.findByRole('toolbar', { name: 'Bulk actions' })
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Switch on' })).toBeTruthy()
  })

  it('does not offer to delete a code an order has used, and deletes one that none has', async () => {
    let deleted = ''
    fakeApi(session(owner, { 'GET /admin/promos': list, [`DELETE /admin/promos/${ids.eid}`]: () => ((deleted = ids.eid), json(204)) }))
    const { user } = renderApp('/promos')
    await user.click(await screen.findByRole('button', { name: 'Actions for WELCOME' }))
    expect((await screen.findByRole('menuitem', { name: /Delete \(used/ })).getAttribute('aria-disabled')).toBe('true')
    await user.keyboard('{Escape}')
    await user.click(await screen.findByRole('button', { name: 'Actions for EID10' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(deleted).toBe(ids.eid))
  })
})

describe('promo form (plan/07-admin/07-promos.md section 3)', () => {
  it('makes the code upper case as it is typed, reads the rule back, and creates it', async () => {
    /** @type {any} */
    let created = null
    fakeApi(session(writer, { 'GET /admin/promos': list, 'POST /admin/promos': ({ body }) => ((created = body), json(201, promoFixture({ ...body, id: uuid(3100) }))) }))
    const { user } = renderApp('/promos?new=1')
    const code = await screen.findByRole('textbox', { name: /^Code/ })
    await user.type(code, 'eid10')
    expect((/** @type {HTMLInputElement} */ (code)).value).toBe('EID10')
    expect(screen.getByRole('status', { name: 'The rule' }).textContent).toMatch(/^10% off everything\. Sale items are not discounted\. Once per customer\./)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(created).toMatchObject({ code: 'EID10', type: 'percent', percent: 10, scope: 'all', excludeSaleItems: true, firstOrderOnly: false, perCustomerLimit: 1, enabled: true }))
    expect(JSON.stringify(created)).not.toMatch(/targetIds|"amount"|maxDiscount/) // nothing that does not belong to this rule
  })

  it('says what is missing before it asks the server, and shows a code that is taken', async () => {
    let posts = 0
    fakeApi(session(writer, { 'GET /admin/promos': list, 'POST /admin/promos': () => (posts++, problem(400, 'validation_failed', { issues: [{ path: 'code', code: 'not_unique' }] })) }))
    const { user } = renderApp('/promos?new=1')
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Required.')).toBeTruthy()
    expect(posts).toBe(0)
    await user.type(screen.getByRole('textbox', { name: /^Code/ }), 'EID10')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('This code already exists.')).toBeTruthy()
    expect(posts).toBe(1)
  })

  it('a percentage code with a cap, a minimum and chosen categories sends exactly that', async () => {
    /** @type {any} */
    let created = null
    fakeApi(session(writer, { 'GET /admin/promos': list, 'POST /admin/promos': ({ body }) => ((created = body), json(201, promoFixture({ ...body, id: uuid(3101) }))) }))
    const { user } = renderApp('/promos?new=1')
    await user.type(await screen.findByRole('textbox', { name: /^Code/ }), 'LAWN15')
    const percent = screen.getByRole('textbox', { name: /Percent off/ })
    await user.clear(percent)
    await user.type(percent, '15')
    await user.type(screen.getByRole('textbox', { name: /Most it may take off/ }), '2000')
    await user.type(screen.getByRole('textbox', { name: /Minimum spend/ }), '5000')
    await user.click(screen.getByRole('radio', { name: /Categories/ }))
    await user.click(await screen.findByRole('combobox', { name: 'Categories' }))
    await user.click(await screen.findByRole('option', { name: 'Lawn' }))
    await user.keyboard('{Escape}')
    expect(screen.getByRole('status', { name: 'The rule' }).textContent).toMatch(/^15% off Lawn, up to Rs 2,000, on orders over Rs 5,000\./)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(created).toMatchObject({ code: 'LAWN15', percent: 15, maxDiscount: money(200000), minSpend: money(500000), scope: 'categories', targetIds: [ids.cat] }))
  })

  it('once an order has used the code, the code and the kind cannot be changed, and the version is sent back', async () => {
    /** @type {any} */
    let saved = null
    const used = promoFixture({ id: ids.used, code: 'WELCOME', usageCount: 4, used: true, version: 7 })
    fakeApi(session(writer, { 'GET /admin/promos': list, [`GET /admin/promos/${ids.used}`]: () => json(200, used), [`PUT /admin/promos/${ids.used}`]: ({ body }) => ((saved = body), json(200, { ...used, ...body })) }))
    const { user } = renderApp(`/promos?edit=${ids.used}`)
    const code = await screen.findByRole('textbox', { name: /^Code/ })
    expect(code.hasAttribute('readonly')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Generate' })).toBeNull()
    for (const radio of screen.getAllByRole('radio', { name: /Percentage off|Fixed amount off|Free delivery/ })) expect(radio.getAttribute('aria-disabled') === 'true' || radio.hasAttribute('disabled') || radio.getAttribute('data-disabled') !== null).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saved).toMatchObject({ code: 'WELCOME', version: 7 }))
  })

  it('"Try this code" sends the form as it stands and a cart, and shows the server\'s answer, applied or not', async () => {
    /** @type {any[]} */
    const asked = []
    let answer = 0
    fakeApi(
      session(writer, {
        'GET /admin/promos': list,
        'GET /admin/products': () => json(200, { items: [productRowFixture()], total: 1, page: 1, size: 25 }),
        [`GET /admin/products/${pid.product}`]: () => json(200, pickProductFixture()),
        'POST /admin/promos/preview': ({ body }) => (
          asked.push(body),
          json(200, answer++ === 0
            ? { applies: true, discount: money(69900), eligibleSubtotal: money(699000), lineDiscounts: [{ variantId: pid.variantM, discount: money(69900) }] }
            : { applies: false, reason: 'promo_min_spend', discount: money(0), eligibleSubtotal: money(0), lineDiscounts: [] })
        ),
      }),
    )
    const { user } = renderApp('/promos?new=1')
    await user.type(await screen.findByRole('textbox', { name: /^Code/ }), 'EID10')
    await user.type(screen.getByRole('searchbox'), 'lawn')
    await user.click(await screen.findByRole('button', { name: /Lawn Suit/ }))
    await user.selectOptions(await screen.findByRole('combobox', { name: /Variant/ }), pid.variantM)
    await user.click(screen.getByRole('button', { name: 'Add to order' }))
    await user.click(screen.getByRole('button', { name: 'Try it' }))
    expect(await screen.findByText('Applies')).toBeTruthy()
    expect(screen.getByText(/Rs\.? ?699\.00/)).toBeTruthy()
    expect(asked[0]).toMatchObject({ promo: { code: 'EID10', percent: 10 }, lines: [{ variantId: pid.variantM, quantity: 1 }] })
    await user.click(screen.getByRole('button', { name: 'Try it' }))
    expect(await screen.findByText('Does not apply')).toBeTruthy()
    expect(screen.getByText('The cart is under the minimum spend.')).toBeTruthy()
  })
})
