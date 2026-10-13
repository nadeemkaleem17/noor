import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setPrefs } from '@/lib/prefs'
import { fakeApi, json, me, renderApp, resetApp } from '@/test/app'
import { countsAnswer, lookupsAnswer, oid, orderFixture, rowFixture } from '@/test/sales-data'

beforeEach(() => {
  setPrefs({ singleKeyShortcuts: true })
  sessionStorage.clear()
})
afterEach(resetApp) // the preference is put back in beforeEach: changing it while the last test's screen is still mounted would redraw it

const everything = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'orders:read', 'orders:edit', 'orders:confirm', 'orders:dispatch', 'orders:deliver', 'orders:note', 'products:read', 'customers:read', 'reviews:read', 'promos:read', 'promos:write', 'settings:read'])
const page = (/** @type {unknown[]} */ items) => json(200, { items, total: items.length, page: 1, size: 50 })
/** @param {import('@noor/contract').Permission[]} permissions @param {Record<string, (r: { body: any; headers: Headers; url: URL }) => Response>} [more] */
const session = (permissions, more = {}) => ({
  'GET /admin/me': () => json(200, me({ permissions })),
  'GET /admin/nav/counts': () => json(200, { ordersNeedingAction: 1, reviewsPending: 0 }),
  'GET /admin/orders/counts': () => json(200, countsAnswer()),
  'GET /admin/orders/lookups': () => json(200, lookupsAnswer()),
  'GET /admin/orders': () => page([rowFixture(), rowFixture({ id: oid.line1, orderNumber: 'RB-10459', customerName: 'Sana Malik' })]),
  ...more,
})
const orderPath = `/admin/orders/${oid.order}`

describe('keys and fields (plan/07-admin/15-shortcuts.md section 5)', () => {
  it('typing j, x and c in the search box types the letters and does nothing else', async () => {
    fakeApi(session(everything))
    const { user, router } = renderApp('/orders')
    const box = await screen.findByRole('searchbox')
    await user.click(box)
    await user.keyboard('jxc')
    expect((/** @type {HTMLInputElement} */ (box)).value).toBe('jxc')
    expect(router.state.location.pathname).toBe('/orders') // "c" did not start a new order
  })

  it('"g" then "o" goes to Orders, and "g" then something else goes nowhere', async () => {
    fakeApi(session(everything))
    const { user, router } = renderApp('/promos')
    await screen.findByRole('heading', { name: 'Promo codes' })
    await user.keyboard('gz')
    expect(router.state.location.pathname).toBe('/promos')
    await user.keyboard('go')
    await waitFor(() => expect(router.state.location.pathname).toBe('/orders'))
  })

  it('a key to a place the role cannot open does nothing, and Reviews only counts while the store has them', async () => {
    fakeApi({ ...session(['dashboard:read', 'products:read']), 'GET /admin/nav/counts': () => json(200, {}) })
    const { user, router } = renderApp('/products')
    await waitFor(() => expect(screen.getByRole('main')).toBeTruthy())
    await user.keyboard('go')
    await user.keyboard('gr')
    expect(router.state.location.pathname).toBe('/products')
  })

  it('"?" opens the sheet of the shortcuts of this screen, by group, made from what is registered', async () => {
    fakeApi(session(everything, { [`GET ${orderPath}`]: () => json(200, orderFixture({ status: 'confirmed', allowedActions: ['dispatch', 'edit_address'] })) }))
    const { user } = renderApp(`/orders/${oid.order}`)
    await screen.findByRole('heading', { name: 'RB-10458' })
    await user.keyboard('?')
    const sheet = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })
    const global = within(within(sheet).getByRole('region', { name: 'Global' }))
    expect(global.getByText('Search and commands')).toBeTruthy()
    expect(global.getByText('Go to Orders')).toBeTruthy()
    const here = within(within(sheet).getByRole('region', { name: 'This screen' }))
    expect(here.getByText('Mark dispatched')).toBeTruthy() // the server allows it and the role may
    expect(here.getByText('Shift D')).toBeTruthy()
    expect(here.queryByText('Confirm order')).toBeNull() // this order cannot be confirmed: no key is listed for it
    expect(here.getByText('Print the invoice')).toBeTruthy()
  })

  it('with single-key shortcuts off only Ctrl and Command ones answer', async () => {
    fakeApi(session(everything, { 'GET /admin/search': () => json(200, { orders: [], products: [], customers: [] }) }))
    const { user, router } = renderApp('/promos')
    await screen.findByRole('heading', { name: 'Promo codes' })
    setPrefs({ singleKeyShortcuts: false })
    await user.keyboard('go')
    expect(router.state.location.pathname).toBe('/promos')
    await user.keyboard('?')
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull()
    await user.keyboard('{Control>}k{/Control}')
    expect(await screen.findByRole('dialog', { name: 'Search and commands' })).toBeTruthy()
  })

  it('while a dialog is open the single keys are quiet', async () => {
    fakeApi(session(everything))
    const { user, router } = renderApp('/orders')
    await screen.findByRole('searchbox')
    await user.keyboard('?')
    await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })
    await user.keyboard('go')
    expect(router.state.location.pathname).toBe('/orders')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('Escape in a field leaves it', async () => {
    fakeApi(session(everything))
    const { user } = renderApp('/orders')
    const box = await screen.findByRole('searchbox')
    await user.click(box)
    expect(document.activeElement).toBe(box)
    await user.keyboard('{Escape}')
    expect(document.activeElement).not.toBe(box)
  })

  it('"/" goes to the search box of the screen', async () => {
    fakeApi(session(everything))
    const { user } = renderApp('/orders')
    const box = await screen.findByRole('searchbox')
    await user.click(document.body)
    await user.keyboard('/')
    expect(document.activeElement).toBe(box)
    expect((/** @type {HTMLInputElement} */ (box)).value).toBe('') // the slash is not typed into it
  })
})

describe('list keys (plan/07-admin/15-shortcuts.md section 3)', () => {
  it('j and k move over the rows, x selects the row in focus, Escape clears, Enter opens', async () => {
    fakeApi(session(everything, { [`GET ${orderPath}`]: () => json(200, orderFixture()) }))
    const { user, router } = renderApp('/orders')
    await screen.findAllByRole('link', { name: /^RB-1045/ })
    const rows = () => [...document.querySelectorAll('tbody tr[data-row-index]')]
    await user.keyboard('j')
    expect(rows()[0]?.className).toContain('outline-focus')
    await user.keyboard('jk')
    expect(rows()[0]?.className).toContain('outline-focus')
    await user.keyboard('j')
    expect(rows()[1]?.className).toContain('outline-focus')
    await user.keyboard('x')
    expect(rows()[1]?.getAttribute('aria-selected')).toBe('true') // selection, not focus
    expect(rows()[0]?.getAttribute('aria-selected')).toBe('false')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(rows()[1]?.getAttribute('aria-selected')).toBe('false'))
    await user.keyboard('k{Enter}')
    await waitFor(() => expect(router.state.location.pathname).toBe(`/orders/${oid.order}`))
  })

  it('Ctrl A selects the page, and "n" and "p" turn the pages', async () => {
    /** @type {string[]} */
    const asked = []
    fakeApi(session(everything, { 'GET /admin/orders': ({ url }) => (asked.push(url.search), json(200, { items: [rowFixture(), rowFixture({ id: oid.line1, orderNumber: 'RB-10459' })], total: 120, page: Number(url.searchParams.get('page') ?? 1), size: 50 })) }))
    const { user, router } = renderApp('/orders')
    await screen.findAllByRole('link', { name: /^RB-1045/ })
    await user.keyboard('{Control>}a{/Control}')
    expect(screen.getByRole('checkbox', { name: 'Select this page' }).getAttribute('aria-checked')).toBe('true')
    await user.keyboard('n')
    await waitFor(() => expect(asked.at(-1)).toContain('page=2'))
    await user.keyboard('p')
    await waitFor(() => expect(router.state.location.search).not.toContain('page=2'))
  })
})

describe('order keys (plan/07-admin/15-shortcuts.md section 4)', () => {
  it('Shift D opens the dispatch dialog of a confirmed order and commits nothing; on an order that cannot be dispatched it does nothing', async () => {
    let posts = 0
    fakeApi(session(everything, { [`GET ${orderPath}`]: () => json(200, orderFixture({ status: 'confirmed', allowedActions: ['dispatch'] })), [`POST ${orderPath}/transitions`]: () => (posts++, json(200, orderFixture())) }))
    const { user } = renderApp(`/orders/${oid.order}`)
    await screen.findByRole('heading', { name: 'RB-10458' })
    await user.keyboard('{Shift>}D{/Shift}')
    expect(await screen.findByRole('dialog', { name: 'Dispatch RB-10458' })).toBeTruthy()
    expect(posts).toBe(0)
  })

  it('Shift D does nothing on an order that cannot be dispatched, and Shift C opens the confirmation of one that can be confirmed', async () => {
    fakeApi(session(everything, { [`GET ${orderPath}`]: () => json(200, orderFixture({ status: 'pending_confirmation', allowedActions: ['confirm', 'cancel'] })) }))
    const { user } = renderApp(`/orders/${oid.order}`)
    await screen.findByRole('heading', { name: 'RB-10458' })
    await user.keyboard('{Shift>}D{/Shift}')
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.keyboard('{Shift>}C{/Shift}')
    expect(await screen.findByRole('dialog', { name: 'Confirm RB-10458' })).toBeTruthy()
  })

  it('"m" puts the cursor in the note box without typing an m, and "a" opens the attempt dialog', async () => {
    fakeApi(session(everything, { [`GET ${orderPath}`]: () => json(200, orderFixture()) }))
    const { user } = renderApp(`/orders/${oid.order}`)
    await screen.findByRole('heading', { name: 'RB-10458' })
    await user.keyboard('m')
    const note = screen.getByRole('textbox', { name: 'New note' })
    expect(document.activeElement).toBe(note)
    expect((/** @type {HTMLTextAreaElement} */ (note)).value).toBe('')
    await user.keyboard('{Escape}')
    await user.keyboard('a')
    expect(await screen.findByRole('dialog', { name: /Log an attempt/ })).toBeTruthy()
  })

  it('"]" and "Shift ]" go to the next and the previous order of the list it was opened from', async () => {
    fakeApi(session(everything, { [`GET ${orderPath}`]: () => json(200, orderFixture()), [`GET /admin/orders/${oid.line1}`]: () => json(200, orderFixture({ id: oid.line1, orderNumber: 'RB-10459' })) }))
    const { user, router } = renderApp('/orders')
    await screen.findAllByRole('link', { name: /^RB-1045/ })
    await user.click(screen.getByRole('link', { name: /^RB-10458/ }))
    await screen.findByRole('heading', { name: 'RB-10458' })
    await user.keyboard(']')
    await waitFor(() => expect(router.state.location.pathname).toBe(`/orders/${oid.line1}`))
    await screen.findByRole('heading', { name: 'RB-10459' })
    await user.keyboard('{Shift>}}{/Shift}')
    await waitFor(() => expect(router.state.location.pathname).toBe(`/orders/${oid.order}`))
  })
})

describe('saving with Ctrl S', () => {
  it('saves the form of an open drawer', async () => {
    /** @type {any} */
    let created = null
    fakeApi(
      session(everything, {
        'GET /admin/promos': () => page([]),
        'GET /admin/categories': () => json(200, { items: [] }),
        'POST /admin/promos': ({ body }) => ((created = body), json(201, { ...body, id: oid.order, status: 'active', usageCount: 0, used: false, targets: [], summary: '', version: 1, createdAt: '2026-10-12T00:00:00.000Z' })),
      }),
    )
    const { user } = renderApp('/promos?new=1')
    await user.type(await screen.findByRole('textbox', { name: /^Code/ }), 'EID10')
    await user.keyboard('{Control>}s{/Control}')
    await waitFor(() => expect(created).toMatchObject({ code: 'EID10' }))
  })
})

describe('command palette (plan/07-admin/15-shortcuts.md section 6)', () => {
  const found = {
    orders: [{ id: oid.order, orderNumber: 'RB-10458', status: 'confirmed', customerName: 'Sana Malik', total: { amount: 724000, currency: 'PKR' } }],
    products: [{ id: oid.line1, title: 'Lawn Suit', sku: 'LS-M', status: 'active', stockStatus: 'in_stock' }],
    customers: [{ id: oid.customer, name: 'Ayesha Khan', phone: '0300 1234567', city: 'Lahore', ordersCount: 3 }],
  }

  it('lists the screens the role may open and the actions, and filters them as you type', async () => {
    fakeApi(session(everything))
    const { user } = renderApp('/orders')
    await screen.findByRole('searchbox')
    await user.keyboard('{Control>}k{/Control}')
    const palette = await screen.findByRole('dialog', { name: 'Search and commands' })
    const options = () => within(palette).getAllByRole('option').map((o) => o.textContent ?? '')
    expect(options().some((t) => t.startsWith('Orders'))).toBe(true)
    expect(options().some((t) => t.startsWith('Staff'))).toBe(false) // no staff:read
    expect(options().some((t) => t.startsWith('New promo code'))).toBe(true)
    await user.type(within(palette).getByRole('combobox'), 'theme')
    await waitFor(() => expect(options()).toEqual(expect.arrayContaining([expect.stringContaining('Toggle theme')])))
    expect(options().some((t) => t.startsWith('Orders'))).toBe(false)
  })

  it('finds an order by what is typed, puts it first, opens it with Enter, and remembers it for the empty box', async () => {
    /** @type {string[]} */
    const asked = []
    fakeApi(session(everything, { 'GET /admin/search': ({ url }) => (asked.push(url.searchParams.get('q') ?? ''), json(200, found)), [`GET ${orderPath}`]: () => json(200, orderFixture()) }))
    const { user, router } = renderApp('/')
    await screen.findByRole('heading', { name: 'Dashboard' })
    await user.keyboard('{Control>}k{/Control}')
    const palette = await screen.findByRole('dialog', { name: 'Search and commands' })
    await user.type(within(palette).getByRole('combobox'), '10458')
    await waitFor(() => expect(asked).toEqual(['10458']))
    const first = (await within(palette).findAllByRole('option'))[0]
    expect(first?.textContent).toContain('RB-10458')
    expect(first?.textContent).toMatch(/confirmed · Rs\.? ?7,240/)
    expect(within(palette).getByText(/Lawn Suit/)).toBeTruthy()
    expect(within(palette).getByText(/Lahore · 3 orders/)).toBeTruthy()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(router.state.location.pathname).toBe(`/orders/${oid.order}`))
    await user.keyboard('{Control>}k{/Control}')
    const again = await screen.findByRole('dialog', { name: 'Search and commands' })
    expect(within(again).getByRole('group', { name: 'Recent' }).textContent).toContain('RB-10458')
  })

  it('still lists the screens and actions when the search fails, and does not search for one letter', async () => {
    /** @type {string[]} */
    const asked = []
    fakeApi(session(everything, { 'GET /admin/search': ({ url }) => (asked.push(url.searchParams.get('q') ?? ''), json(500, { title: 'x', status: 500, code: 'internal_error' })) }))
    const { user } = renderApp('/orders')
    await screen.findByRole('searchbox')
    await user.keyboard('{Control>}k{/Control}')
    const palette = await screen.findByRole('dialog', { name: 'Search and commands' })
    await user.type(within(palette).getByRole('combobox'), 'o')
    expect(asked).toEqual([])
    await user.type(within(palette).getByRole('combobox'), 'rders')
    expect(await within(palette).findByText(/The search is not available now/)).toBeTruthy()
    expect(within(palette).getAllByRole('option').some((o) => o.textContent?.startsWith('Orders'))).toBe(true)
  })

  it('a role with no orders gets what the server gives it, and no Orders entry in "Go to"', async () => {
    fakeApi({ ...session(['dashboard:read', 'products:read'], { 'GET /admin/search': () => json(200, { orders: [], products: found.products, customers: [] }) }), 'GET /admin/nav/counts': () => json(200, {}) })
    const { user } = renderApp('/products')
    await waitFor(() => expect(screen.getByRole('main')).toBeTruthy())
    await user.keyboard('{Control>}k{/Control}')
    const palette = await screen.findByRole('dialog', { name: 'Search and commands' })
    await user.type(within(palette).getByRole('combobox'), 'lawn')
    expect(await within(palette).findByText(/Lawn Suit/)).toBeTruthy()
    const names = within(palette).getAllByRole('option').map((o) => o.textContent ?? '')
    expect(names.some((n) => n.startsWith('Orders'))).toBe(false)
    expect(names.some((n) => n.includes('Sana'))).toBe(false)
  })
})
