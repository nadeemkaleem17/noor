import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const u = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-0000000005${String(n).padStart(2, '0')}`
const cat = (/** @type {number} */ n, /** @type {string} */ name, /** @type {number | null} */ parent, extra = {}) => ({
  id: u(n), name, handle: name.toLowerCase(), parentId: parent === null ? null : u(parent), visible: true, attributes: [], sortOrder: n, productCount: n, version: 2, shop: { shown: true, liveProducts: n }, ...extra,
})
const tree = [
  cat(1, 'Women', null),
  cat(2, 'Stitched', 1),
  cat(3, 'Unstitched', 1),
  cat(4, 'Lawn', 3, { shop: { shown: false, reason: 'no_live_products', liveProducts: 0 } }),
  cat(5, 'Footwear', null),
  cat(6, 'Sandals', 5),
]
const perms = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'catalog:read', 'catalog:write', 'catalog:delete'])
/** @param {import('@noor/contract').Permission[]} [permissions] @param {Record<string, (r: { body: any; headers: Headers; url: URL }) => Response>} [more] */
const session = (permissions = perms, more = {}) => ({
  'GET /admin/me': () => json(200, me({ permissions })),
  'GET /admin/categories': () => json(200, { items: tree }),
  ...more,
})
const names = () => within(screen.getByRole('table')).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent ?? ''))

describe('subcategories (plan/17-owner-requests-2026-10.md item 7)', () => {
  it('lists every category that has a parent, with the parent beside it and why one is not on the website', async () => {
    fakeApi(session())
    renderApp('/subcategories')
    await screen.findByRole('table', { name: 'Subcategories' })
    const rows = names()
    expect(rows.map((r) => (r[1] ?? "").replace(/\/c\/.*/, ''))).toEqual(['Sandals', 'Stitched', 'Unstitched', 'Lawn']) // by parent, then in the shop's own order
    expect(rows).toHaveLength(4)
    const lawn = rows.find((r) => (r[1] ?? "").startsWith('Lawn'))
    expect(lawn?.[2]).toBe('Women › Unstitched')
    expect(lawn?.[4]).toBe('No product for sale yet')
    expect(screen.queryByText('Women/c/women')).toBeNull() // a top-level category is not a subcategory
  })

  it('searches by name, filters by parent at any depth, and by whether the website shows it', async () => {
    fakeApi(session())
    const { user } = renderApp('/subcategories')
    await screen.findByRole('table', { name: 'Subcategories' })
    await user.type(screen.getByRole('searchbox'), 'sand')
    await waitFor(() => expect(names()).toHaveLength(1))
    await user.clear(screen.getByRole('searchbox'))
    await user.selectOptions(screen.getByLabelText('Parent'), u(1))
    await waitFor(() => expect(names().map((r) => (r[1] ?? "").replace(/\/c\/.*/, '')).sort()).toEqual(['Lawn', 'Stitched', 'Unstitched'])) // Lawn is two levels down
    await user.selectOptions(screen.getByLabelText('On the website'), 'not')
    await waitFor(() => expect(names().map((r) => (r[1] ?? "").replace(/\/c\/.*/, ''))).toEqual(['Lawn']))
  })

  it('deletes the chosen ones together after a confirmation that names them, and says which one stayed and why', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(session(perms, {
      'POST /admin/categories/bulk-delete': ({ body }) => {
        sent = body
        return json(200, { succeeded: [u(6)], failed: [{ id: u(3), code: 'in_use', detail: 'It is used by 1 child category, so it cannot be deleted.' }] })
      },
    }))
    const { user } = renderApp('/subcategories')
    await screen.findByRole('table', { name: 'Subcategories' })
    await user.click(screen.getByRole('checkbox', { name: 'Select Sandals' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Unstitched' }))
    const bar = await screen.findByRole('toolbar', { name: 'Bulk actions' })
    expect(within(bar).getByText('2 selected')).toBeTruthy()
    await user.click(within(bar).getByRole('button', { name: 'Delete selected' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/Delete 2 subcategories\?/)).toBeTruthy()
    expect(within(dialog).getByText(/Unstitched, Sandals|Sandals, Unstitched/)).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(sent).not.toBeNull())
    expect(new Set(sent.ids)).toEqual(new Set([u(3), u(6)]))
    expect((await screen.findAllByText('1 deleted, 1 not')).length).toBeGreaterThan(0)
    // the one that could not go stays chosen
    await waitFor(() => expect(screen.getByText('1 selected')).toBeTruthy())
  })

  it('gives a role without catalog:delete no checkboxes and no delete', async () => {
    fakeApi(session(['dashboard:read', 'catalog:read', 'catalog:write']))
    const { user } = renderApp('/subcategories')
    await screen.findByRole('table', { name: 'Subcategories' })
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Actions for Sandals' }))
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['Edit', 'Add a subcategory'])
  })

  it('starts a new subcategory under the parent chosen in the filter', async () => {
    fakeApi(session())
    const { router, user } = renderApp('/subcategories')
    await screen.findByRole('table', { name: 'Subcategories' })
    await user.selectOptions(screen.getByLabelText('Parent'), u(5))
    await user.click(screen.getByRole('button', { name: 'New subcategory' }))
    expect(router.state.location.search).toBe(`?new=${u(5)}`)
    const drawer = await screen.findByRole('dialog', { name: 'New category' })
    expect((/** @type {HTMLSelectElement} */ (within(drawer).getByLabelText(/^Parent/))).value).toBe(u(5))
  })
})
