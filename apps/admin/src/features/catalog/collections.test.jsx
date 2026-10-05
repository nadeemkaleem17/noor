import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const u = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-0000000007${String(n).padStart(2, '0')}`
const productRow = (/** @type {number} */ n, /** @type {string} */ title) => ({
  id: u(n), handle: title.toLowerCase().replace(/ /g, '-'), title, status: 'active', kind: 'stitched', primaryCategory: { id: u(90), name: 'Women' }, variantCount: 2, stockStatus: 'in_stock',
  priceFrom: { amount: 100000, currency: 'PKR' }, updatedAt: '2026-10-05T10:00:00.000Z', hasIssues: false,
})
const collection = {
  id: u(1), title: 'Eid Edit', handle: 'eid-edit', status: 'active', featured: true, productIds: [u(11), u(12), u(13)], version: 3, updatedAt: '2026-10-05T10:00:00.000Z',
  products: [productRow(11, 'Lawn Suit'), productRow(12, 'Silk Kurta'), productRow(13, 'Chiffon Dupatta')],
}
const row = { id: u(1), title: 'Eid Edit', handle: 'eid-edit', status: 'active', featured: true, productCount: 3, updatedAt: '2026-10-05T10:00:00.000Z' }
const perms = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'catalog:read', 'catalog:write', 'catalog:delete', 'products:read', 'content:write'])
const session = (/** @type {import('@noor/contract').Permission[]} */ permissions = perms) => ({
  'GET /admin/me': () => json(200, me({ permissions })),
  'GET /admin/collections': () => json(200, { items: [row], total: 1, page: 1, size: 50 }),
  [`GET /admin/collections/${u(1)}`]: () => json(200, collection),
})

describe('collections list', () => {
  it('lists collections with a link to each and a status filter', async () => {
    fakeApi(session())
    renderApp('/collections')
    const link = await screen.findByRole('link', { name: 'Eid Edit' })
    expect(link.getAttribute('href')).toBe(`/collections/${u(1)}`)
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'New collection' }).getAttribute('href')).toBe('/collections/new')
  })

  it('hides New collection from a role that cannot write', async () => {
    fakeApi(session(['dashboard:read', 'catalog:read']))
    renderApp('/collections')
    await screen.findByRole('link', { name: 'Eid Edit' })
    expect(screen.queryByRole('link', { name: 'New collection' })).toBeNull()
  })
})

describe('collection editor (plan/07-admin/04-catalog.md section 3)', () => {
  it('shows the members in order and saves a new order with the stored version', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({ ...session(), [`PUT /admin/collections/${u(1)}`]: ({ body }) => ((sent = body), json(200, { ...collection, ...body, version: 4 })) })
    const { user } = renderApp(`/collections/${u(1)}`)
    const table = await screen.findByRole('region', { name: 'Products in the collection' })
    expect(within(table).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0]?.textContent)).toEqual(['Lawn Suit', 'Silk Kurta', 'Chiffon Dupatta'])
    await user.click(within(table).getByRole('button', { name: 'Move Chiffon Dupatta to the top' }))
    await user.click(within(table).getByRole('button', { name: 'Remove Silk Kurta' }))
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0] ?? table)
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent).toMatchObject({ version: 3, title: 'Eid Edit', handle: 'eid-edit', status: 'active', featured: true, productIds: [u(13), u(11)] })
    expect(sent).not.toHaveProperty('replaceFeaturedId')
  })

  it('adds a product found by search to the end of the list', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({
      ...session(),
      'GET /admin/products': () => json(200, { items: [productRow(21, 'Khaddar Shawl')], total: 1, page: 1, size: 25 }),
      [`PUT /admin/collections/${u(1)}`]: ({ body }) => ((sent = body), json(200, { ...collection, ...body })),
    })
    const { user } = renderApp(`/collections/${u(1)}`)
    await user.type(await screen.findByRole('combobox', { name: 'Add a product' }), 'khad')
    await user.click(await screen.findByRole('option', { name: 'Khaddar Shawl' }, { timeout: 5000 }))
    const table = await screen.findByRole('region', { name: 'Products in the collection' })
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(5))
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0] ?? table)
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent.productIds).toEqual([u(11), u(12), u(13), u(21)])
  })

  it('asks which featured collection to replace when a fourth is featured, then saves with that choice', async () => {
    /** @type {any[]} */
    const puts = []
    fakeApi({
      ...session(),
      [`GET /admin/collections/${u(1)}`]: () => json(200, { ...collection, featured: false }),
      [`PUT /admin/collections/${u(1)}`]: ({ body }) => {
        puts.push(body)
        return body.replaceFeaturedId
          ? json(200, { ...collection, ...body, replaceFeaturedId: undefined })
          : problem(400, 'validation_failed', { issues: [{ path: 'featured', code: 'too_big' }], featured: [{ id: u(2), title: 'Summer' }, { id: u(3), title: 'Winter' }, { id: u(4), title: 'Bridal' }] })
      },
    })
    const { user } = renderApp(`/collections/${u(1)}`)
    await user.click(await screen.findByRole('switch', { name: 'Featured on the home page' }))
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0] ?? document.body)
    const dialog = await screen.findByRole('dialog', { name: 'Three collections are already featured' })
    expect(/** @type {HTMLButtonElement} */ (within(dialog).getByRole('button', { name: 'Replace and save' })).disabled).toBe(true)
    await user.click(within(dialog).getByRole('radio', { name: 'Winter' }))
    await user.click(within(dialog).getByRole('button', { name: 'Replace and save' }))
    await waitFor(() => expect(puts).toHaveLength(2))
    expect(puts[1].replaceFeaturedId).toBe(u(3))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Three collections are already featured' })).toBeNull())
  })

  it('creates a collection with a handle from the title and opens it', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({
      ...session(),
      'POST /admin/collections': ({ body }) => ((sent = body), json(201, { ...collection, ...body, id: u(9), version: 1 })),
      [`GET /admin/collections/${u(9)}`]: () => json(200, { ...collection, id: u(9), title: 'Summer Drop', handle: 'summer-drop', productIds: [], products: [] }),
    })
    const { router, user } = renderApp('/collections/new')
    await user.type(await screen.findByLabelText(/^Title/), 'Summer Drop')
    expect((/** @type {HTMLInputElement} */ (screen.getByLabelText(/^Handle/))).value).toBe('summer-drop')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0] ?? document.body)
    await waitFor(() => expect(router.state.location.pathname).toBe(`/collections/${u(9)}`))
    expect(sent).toMatchObject({ title: 'Summer Drop', handle: 'summer-drop', status: 'draft', featured: false, productIds: [] })
    expect(sent).not.toHaveProperty('startsAt')
  })

  it('asks before leaving with unsaved changes', async () => {
    fakeApi(session())
    const { router, user } = renderApp(`/collections/${u(1)}`)
    await user.type(await screen.findByLabelText(/^Title/), '!')
    void router.navigate('/collections')
    const dialog = await screen.findByRole('alertdialog', { name: 'Leave without saving?' })
    await user.click(within(dialog).getByRole('button', { name: 'Leave' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/collections'))
  })

  it('deletes after a confirmation and returns to the list', async () => {
    fakeApi({ ...session(), [`DELETE /admin/collections/${u(1)}`]: () => json(204) })
    const { router, user } = renderApp(`/collections/${u(1)}`)
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/collections'))
  })

  it('is read-only for a role without catalog:write', async () => {
    fakeApi(session(['dashboard:read', 'catalog:read']))
    renderApp(`/collections/${u(1)}`)
    const title = await screen.findByLabelText(/^Title/)
    expect(/** @type {HTMLInputElement} */ (title).readOnly).toBe(true)
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Add a product' })).toBeNull()
  })
})
