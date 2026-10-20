import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const u = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-0000000004${String(n).padStart(2, '0')}`
const cat = (/** @type {number} */ n, /** @type {string} */ name, /** @type {number | null} */ parent, sortOrder = 0, extra = {}) => ({
  id: u(n), name, handle: name.toLowerCase(), parentId: parent === null ? null : u(parent), visible: true, attributes: [], sortOrder, productCount: n, version: 2, shop: { shown: true, liveProducts: n }, ...extra,
})
const women = cat(1, 'Women', null, 0)
const stitched = cat(2, 'Stitched', 1, 1)
const unstitched = cat(3, 'Unstitched', 1, 0)
const lawn = cat(4, 'Lawn', 3, 0)
const footwear = cat(5, 'Footwear', null, 1)
const tree = [women, stitched, unstitched, lawn, footwear]

const perms = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'catalog:read', 'catalog:write', 'catalog:delete', 'content:write'])
const session = (/** @type {import('@noor/contract').Permission[]} */ permissions = perms) => ({
  'GET /admin/me': () => json(200, me({ permissions })),
  'GET /admin/categories': () => json(200, { items: tree }),
})

describe('categories (plan/07-admin/04-catalog.md section 2)', () => {
  it('shows the tree in order with product counts that link to the filtered product list', async () => {
    fakeApi(session())
    renderApp('/categories')
    const treeEl = await screen.findByRole('tree', { name: 'Categories' })
    const items = within(treeEl).getAllByRole('treeitem')
    expect(items.map((i) => i.getAttribute('aria-level'))).toEqual(['1', '2', '3', '2', '1'])
    expect(items.map((i) => within(i).getAllByRole('button')[1]?.textContent ?? '')).toEqual(expect.any(Array))
    expect(within(treeEl).getAllByText(/^\/c\//).map((e) => e.textContent)).toEqual(['/c/women', '/c/unstitched', '/c/lawn', '/c/stitched', '/c/footwear'])
    expect(within(treeEl).getByRole('link', { name: '5 products' }).getAttribute('href')).toBe(`/products?category=${u(5)}`)
  })

  it('says beside a category why the website does not offer it, so nobody has to guess', async () => {
    const odd = [
      cat(1, 'Volume1', null, 0, { shop: { shown: false, reason: 'no_live_products', liveProducts: 0 } }),
      cat(2, 'Secret', null, 1, { visible: false, shop: { shown: false, reason: 'hidden', liveProducts: 3 } }),
      cat(3, 'Insidesecret', 2, 0, { shop: { shown: false, reason: 'parent_hidden', liveProducts: 1 } }),
      cat(4, 'Women', null, 2),
    ]
    fakeApi({ ...session(), 'GET /admin/categories': () => json(200, { items: odd }) })
    renderApp('/categories')
    const treeEl = await screen.findByRole('tree', { name: 'Categories' })
    expect(within(treeEl).getByText(/no product for sale in it yet \(a draft does not count\)/)).toBeTruthy()
    expect(within(treeEl).getByText('Hidden: not on the website')).toBeTruthy()
    expect(within(treeEl).getByText(/a category above it is hidden/)).toBeTruthy()
    expect(within(treeEl).getAllByText(/Not on the website|Hidden: not on the website/)).toHaveLength(3) // Women, shown, has no note
  })

  it('collapses and expands a branch', async () => {
    fakeApi(session())
    const { user } = renderApp('/categories')
    await screen.findByRole('tree')
    await user.click(screen.getByRole('button', { name: 'Collapse Women' }))
    expect(screen.queryByText('/c/stitched')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Expand Women' }))
    expect(await screen.findByText('/c/stitched')).toBeTruthy()
  })

  it('moves a category at once and tells the server the new order of its siblings', async () => {
    /** @type {any} */
    let sent = null
    // the fake server keeps the new order, as the real one does, so the refetch after the move agrees
    let items = tree
    fakeApi({
      ...session(),
      'GET /admin/categories': () => json(200, { items }),
      'POST /admin/categories/reorder': ({ body }) => {
        sent = body
        items = items.map((c) => (body.orderedIds.includes(c.id) ? { ...c, sortOrder: body.orderedIds.indexOf(c.id) } : c))
        return json(204)
      },
    })
    const { user } = renderApp('/categories')
    await user.click(await screen.findByRole('button', { name: 'Move Stitched up' }))
    expect(sent).toEqual({ parentId: u(1), orderedIds: [u(2), u(3)] })
    const names = () => within(screen.getByRole('tree')).getAllByRole('treeitem').map((i) => i.getAttribute('aria-level') + ':' + (i.querySelector('button[class*="hover:underline"]')?.textContent ?? ''))
    await waitFor(() => expect(names().slice(0, 3)).toEqual(['1:Women', '2:Stitched', '2:Unstitched']))
  })

  it('puts the order back and says so when the server refuses', async () => {
    fakeApi({ ...session(), 'POST /admin/categories/reorder': () => problem(409, 'stale_write') })
    const { user } = renderApp('/categories')
    await user.click(await screen.findByRole('button', { name: 'Move Stitched up' }))
    expect((await screen.findAllByText('The order could not be saved, so it was put back.')).length).toBeGreaterThan(0)
    await waitFor(() => {
      const first = within(screen.getByRole('tree')).getAllByRole('treeitem')[1]
      expect(first?.querySelector('button[class*="hover:underline"]')?.textContent).toBe('Unstitched')
    })
  })

  it('opens the drawer from the address and shows the stored values', async () => {
    fakeApi(session())
    renderApp(`/categories?edit=${u(2)}`)
    const drawer = await screen.findByRole('dialog', { name: 'Edit Stitched' })
    expect((/** @type {HTMLInputElement} */ (within(drawer).getByLabelText(/^Handle/))).value).toBe('stitched')
    expect((/** @type {HTMLSelectElement} */ (within(drawer).getByLabelText(/^Parent/))).value).toBe(u(1))
  })

  it('does not offer the category itself or its descendants as a parent, nor a third-level parent', async () => {
    fakeApi(session())
    renderApp(`/categories?edit=${u(3)}`)
    const select = await screen.findByLabelText(/^Parent/)
    const labels = within(select).getAllByRole('option').map((o) => o.textContent)
    expect(labels).toContain('Women')
    expect(labels).not.toContain('Women › Unstitched')
    expect(labels).not.toContain('Women › Unstitched › Lawn')
  })

  it('creates a category with a handle from the name and sends it under its parent', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({ ...session(), 'POST /admin/categories': ({ body }) => ((sent = body), json(201, { ...cat(9, 'Kids', 1), ...body, id: u(9), sortOrder: 2, productCount: 0, version: 1 })) })
    const { router, user } = renderApp('/categories')
    await user.click(await screen.findByRole('button', { name: 'New category' }))
    expect(router.state.location.search).toBe('?new=1')
    const drawer = await screen.findByRole('dialog', { name: 'New category' })
    await user.type(within(drawer).getByLabelText(/^Name/), 'Kids Wear')
    expect((/** @type {HTMLInputElement} */ (within(drawer).getByLabelText(/^Handle/))).value).toBe('kids-wear')
    await user.selectOptions(within(drawer).getByLabelText(/^Parent/), 'Women')
    await user.click(within(drawer).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent).toMatchObject({ name: 'Kids Wear', handle: 'kids-wear', parentId: u(1), visible: true })
    expect(sent).not.toHaveProperty('description')
    await waitFor(() => expect(router.state.location.search).toBe(''))
  })

  it('"Add a subcategory" starts a new category under that one', async () => {
    fakeApi(session())
    const { router, user } = renderApp('/categories')
    await user.click(await screen.findByRole('button', { name: 'Actions for Footwear' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Add a subcategory' }))
    expect(router.state.location.search).toBe(`?new=${u(5)}`)
    const drawer = await screen.findByRole('dialog', { name: 'New category' })
    expect((/** @type {HTMLSelectElement} */ (within(drawer).getByLabelText(/^Parent/))).value).toBe(u(5))
  })

  it('edits with the stored version and can move a category to the top level', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({ ...session(), [`PUT /admin/categories/${u(2)}`]: ({ body }) => ((sent = body), json(200, { ...stitched, ...body })) })
    const { user } = renderApp(`/categories?edit=${u(2)}`)
    const drawer = await screen.findByRole('dialog', { name: 'Edit Stitched' })
    await user.selectOptions(within(drawer).getByLabelText(/^Parent/), '')
    await user.click(within(drawer).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent).toMatchObject({ version: 2, parentId: null, handle: 'stitched' })
  })

  it('says what blocks a delete', async () => {
    fakeApi({ ...session(), [`DELETE /admin/categories/${u(1)}`]: () => problem(409, 'in_use', { usedBy: { children: 2, products: 1 } }) })
    const { user } = renderApp('/categories')
    await user.click(await screen.findByRole('button', { name: 'Actions for Women' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect((await screen.findAllByText('It is used by 2 child categories and 1 product, so it cannot be deleted.')).length).toBeGreaterThan(0)
  })

  it('gives a role without catalog:write no add, move or delete controls', async () => {
    fakeApi(session(['dashboard:read', 'catalog:read']))
    const { user } = renderApp('/categories')
    await screen.findByRole('tree')
    expect(screen.queryByRole('button', { name: 'New category' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Move / })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Actions for Women' }))
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['View'])
  })
})
