import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { categoriesAnswer, fakeApi, ids2, json, me, problem, productFixture, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

/** @param {Partial<Parameters<typeof me>[0]>} [over] */
const session = (over = {}) => ({
  'GET /admin/me': () => json(200, me({ permissions: ['dashboard:read', 'products:read', 'products:write', 'products:publish', 'products:delete', 'catalog:read'], ...over })),
  'GET /admin/categories': categoriesAnswer,
  'POST /admin/products/publish-checks': () => json(200, { checks: [{ code: 'basics', ok: true }, { code: 'images', ok: false, path: 'media' }] }),
})

const open = (/** @type {string} */ id = ids2.product) => `/admin/products/${id}`

describe('product editor: loading, saving and leaving (plan/07-admin/03-products.md sections 3, 8 and 9)', () => {
  it('shows the stored product, with the checks the server reports', async () => {
    fakeApi({ ...session(), [`GET ${open()}`]: () => json(200, productFixture()) })
    renderApp(`/products/${ids2.product}`)
    expect(await screen.findByDisplayValue('Cotton Kurta')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Cotton Kurta', level: 1 })).toBeTruthy()
    expect(await screen.findByText('At least one image')).toBeTruthy()
    expect(screen.getByText('Not ready to publish')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull()
  })

  it('saves with the stored version, then clears the unsaved bar', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({
      ...session(),
      [`GET ${open()}`]: () => json(200, productFixture()),
      [`PUT ${open()}`]: ({ body }) => {
        sent = body
        return json(200, productFixture({ ...body, version: 4 }))
      },
    })
    const { user } = renderApp(`/products/${ids2.product}`)
    const title = await screen.findByLabelText(/^Title/)
    await user.clear(title)
    await user.type(title, 'Cotton Kurta Long')
    expect(await screen.findByRole('region', { name: 'Unsaved changes' })).toBeTruthy()
    await user.click(within(screen.getByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Product saved')).toBeTruthy()
    expect(sent).toMatchObject({ title: 'Cotton Kurta Long', version: 3, handle: 'cotton-kurta' })
    expect(sent).not.toHaveProperty('subtitle') // never-filled fields are not sent as empty strings
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull())
  })

  it('names the fields that are missing and does not call the API', async () => {
    const calls = fakeApi({ ...session() })
    const { user } = renderApp('/products/new')
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    expect((await screen.findAllByText('This field is required')).length).toBeGreaterThan(0)
    expect(calls.filter((c) => c.startsWith('POST /admin/products') && !c.includes('publish-checks'))).toEqual([])
  })

  it('creates a product, suggesting the handle from the title, and moves to its page', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({
      ...session(),
      'POST /admin/products': ({ body }) => {
        sent = body
        return json(201, productFixture({ ...body, version: 1 }))
      },
      [`GET ${open()}`]: () => json(200, productFixture({ title: 'Silk Formal 2-Piece', handle: 'silk-formal-2-piece', version: 1 })),
    })
    const { router, user } = renderApp('/products/new')
    await user.type(await screen.findByLabelText(/^Title/), 'Silk Formal 2-Piece')
    expect((/** @type {HTMLInputElement} */ (screen.getByLabelText(/^Handle/))).value).toBe('silk-formal-2-piece')
    await user.selectOptions(screen.getByLabelText(/Primary category/), 'Women › Stitched')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0] ?? document.body)
    await waitFor(() => expect(router.state.location.pathname).toBe(`/products/${ids2.product}`))
    expect(sent).toMatchObject({ title: 'Silk Formal 2-Piece', handle: 'silk-formal-2-piece', primaryCategoryId: ids2.cat2, status: 'draft', kind: 'stitched' })
    expect(sent).not.toHaveProperty('version')
  })

  it('offers "Reload their version" and "Overwrite with mine" when someone else saved first', async () => {
    /** @type {any[]} */
    const puts = []
    fakeApi({
      ...session(),
      [`GET ${open()}`]: () => json(200, productFixture()),
      [`PUT ${open()}`]: ({ body }) => {
        puts.push(body)
        return body.version === 3 ? problem(409, 'stale_write', { currentVersion: 5 }) : json(200, productFixture({ ...body, version: 6 }))
      },
    })
    const { user } = renderApp(`/products/${ids2.product}`)
    const title = await screen.findByLabelText(/^Title/)
    await user.clear(title)
    await user.type(title, 'Mine')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0] ?? title)
    const dialog = await screen.findByRole('dialog', { name: 'Someone else changed this product' })
    await user.click(within(dialog).getByRole('button', { name: 'Overwrite with mine' }))
    expect(await screen.findByText('Product saved')).toBeTruthy()
    expect(puts.map((p) => p.version)).toEqual([3, 5])
  })

  it('reloads their version into the form', async () => {
    let reads = 0
    fakeApi({
      ...session(),
      [`GET ${open()}`]: () => json(200, reads++ === 0 ? productFixture() : productFixture({ title: 'Theirs', version: 5 })),
      [`PUT ${open()}`]: () => problem(409, 'stale_write', { currentVersion: 5 }),
    })
    const { user } = renderApp(`/products/${ids2.product}`)
    const title = await screen.findByLabelText(/^Title/)
    await user.clear(title)
    await user.type(title, 'Mine')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0] ?? title)
    const dialog = await screen.findByRole('dialog', { name: 'Someone else changed this product' })
    await user.click(within(dialog).getByRole('button', { name: 'Reload their version' }))
    await waitFor(() => expect(screen.getByDisplayValue('Theirs')).toBeTruthy())
    expect(screen.queryByRole('dialog', { name: 'Someone else changed this product' })).toBeNull()
  })

  it('does not offer "Overwrite with mine" to a role that cannot publish', async () => {
    fakeApi({
      ...session({ permissions: ['dashboard:read', 'products:read', 'products:write', 'catalog:read'] }),
      [`GET ${open()}`]: () => json(200, productFixture()),
      [`PUT ${open()}`]: () => problem(409, 'stale_write', { currentVersion: 5 }),
    })
    const { user } = renderApp(`/products/${ids2.product}`)
    const title = await screen.findByLabelText(/^Title/)
    await user.type(title, '!')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0] ?? title)
    const dialog = await screen.findByRole('dialog', { name: 'Someone else changed this product' })
    expect(within(dialog).queryByRole('button', { name: 'Overwrite with mine' })).toBeNull()
  })

  it('puts a server field error on its field', async () => {
    fakeApi({
      ...session(),
      [`GET ${open()}`]: () => json(200, productFixture()),
      [`PUT ${open()}`]: () => problem(400, 'validation_failed', { issues: [{ path: 'handle', code: 'not_unique' }] }),
    })
    const { user } = renderApp(`/products/${ids2.product}`)
    await user.type(await screen.findByLabelText(/^Title/), '!')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0] ?? screen.getByLabelText(/^Title/))
    expect(await screen.findByText('This value is already used')).toBeTruthy()
  })

  it('asks before leaving with unsaved changes', async () => {
    fakeApi({ ...session(), [`GET ${open()}`]: () => json(200, productFixture()) })
    const { router, user } = renderApp(`/products/${ids2.product}`)
    await user.type(await screen.findByLabelText(/^Title/), '!')
    void router.navigate('/products')
    const dialog = await screen.findByRole('alertdialog', { name: 'Leave without saving?' })
    await user.click(within(dialog).getByRole('button', { name: 'Leave' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/products'))
  })

  it('only lets a role that can publish leave draft', async () => {
    fakeApi({
      ...session({ permissions: ['dashboard:read', 'products:read', 'products:write', 'catalog:read'] }),
      [`GET ${open()}`]: () => json(200, productFixture()),
    })
    renderApp(`/products/${ids2.product}`)
    const status = await screen.findByRole('combobox', { name: 'Status' })
    expect(within(status).getAllByRole('option').map((o) => o.textContent)).toEqual(['Draft'])
    expect(screen.getByText('Publishing needs a manager.')).toBeTruthy()
  })

  it('duplicates and opens the copy; refuses to delete a product that has orders', async () => {
    const copy = '0194f1b2-7c3a-7000-8000-0000000000a2'
    fakeApi({
      ...session(),
      [`GET ${open()}`]: () => json(200, productFixture()),
      [`GET ${open(copy)}`]: () => json(200, productFixture({ id: copy, handle: 'cotton-kurta-copy', title: 'Cotton Kurta (copy)' })),
      [`POST ${open()}/duplicate`]: () => json(201, productFixture({ id: copy, handle: 'cotton-kurta-copy', title: 'Cotton Kurta (copy)' })),
      [`DELETE ${open(copy)}`]: () => problem(409, 'in_use'),
    })
    const { router, user } = renderApp(`/products/${ids2.product}`)
    await user.click(await screen.findByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/products/${copy}`))
    expect(await screen.findByDisplayValue('Cotton Kurta (copy)')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect((await screen.findAllByText('This product has orders, so it cannot be deleted. Archive it instead.')).length).toBeGreaterThan(0)
    expect(router.state.location.pathname).toBe(`/products/${copy}`)
  })
})
