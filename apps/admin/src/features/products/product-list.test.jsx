import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { categoriesAnswer, fakeApi, ids2, json, me, problem, productFixture, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const row = (/** @type {Record<string, unknown>} */ over = {}) => ({
  id: ids2.product,
  handle: 'cotton-kurta',
  title: 'Cotton Kurta',
  colorwayLabel: 'White',
  image: { src: 'http://localhost:3000/img/a.jpg', srcset: '', width: 900, height: 1200, alt: '' },
  status: 'active',
  kind: 'stitched',
  primaryCategory: { id: ids2.cat, name: 'Women' },
  variantCount: 5,
  stockStatus: 'in_stock',
  priceFrom: { amount: 349000, currency: 'PKR' },
  updatedAt: '2026-10-05T10:00:00.000Z',
  hasIssues: false,
  ...over,
})
const page = (/** @type {unknown[]} */ items) => json(200, { items, total: items.length, page: 1, size: 50 })
const session = (/** @type {import('@noor/contract').Permission[]} */ permissions) => ({
  'GET /admin/me': () => json(200, me({ permissions })),
  'GET /admin/categories': categoriesAnswer,
})
const all = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'products:read', 'products:write', 'products:publish', 'products:delete', 'catalog:read'])
const open = `/admin/products/${ids2.product}`

describe('product list (plan/07-admin/03-products.md section 2)', () => {
  it('shows a thumbnail, the colourway and the variant count, and filters by category', async () => {
    fakeApi({ ...session(all), 'GET /admin/products': () => page([row()]) })
    renderApp('/products')
    expect(await screen.findByRole('link', { name: /Cotton Kurta \(White\)/ })).toBeTruthy()
    expect(screen.getByText('5 variants')).toBeTruthy()
    expect(document.querySelector('img[src="http://localhost:3000/img/a.jpg"]')).toBeTruthy()
    const category = await screen.findByRole('combobox', { name: 'Category' })
    expect(within(category).getByRole('option', { name: 'Women › Stitched' })).toBeTruthy()
  })

  it('archives from the row menu by saving the stored product with a new status', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({
      ...session(all),
      'GET /admin/products': () => page([row()]),
      [`GET ${open}`]: () => json(200, productFixture({ status: 'active', version: 7 })),
      [`PUT ${open}`]: ({ body }) => {
        sent = body
        return json(200, productFixture({ ...body, version: 8 }))
      },
    })
    const { user } = renderApp('/products')
    await user.click(await screen.findByRole('button', { name: 'Actions for Cotton Kurta' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Archive' }))
    expect((await screen.findAllByText('Cotton Kurta archived')).length).toBeGreaterThan(0)
    expect(sent).toMatchObject({ status: 'archived', version: 7, handle: 'cotton-kurta', title: 'Cotton Kurta' })
  })

  it('refuses to delete a product that has orders, and says what to do', async () => {
    fakeApi({ ...session(all), 'GET /admin/products': () => page([row()]), [`DELETE ${open}`]: () => problem(409, 'in_use') })
    const { user } = renderApp('/products')
    await user.click(await screen.findByRole('button', { name: 'Actions for Cotton Kurta' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect((await screen.findAllByText('This product has orders, so it cannot be deleted. Archive it instead.')).length).toBeGreaterThan(0)
  })

  it('duplicates and opens the copy', async () => {
    const copy = '0194f1b2-7c3a-7000-8000-0000000000a9'
    fakeApi({
      ...session(all),
      'GET /admin/products': () => page([row()]),
      [`POST ${open}/duplicate`]: () => json(201, productFixture({ id: copy, handle: 'cotton-kurta-copy', title: 'Cotton Kurta (copy)' })),
      [`GET /admin/products/${copy}`]: () => json(200, productFixture({ id: copy, handle: 'cotton-kurta-copy', title: 'Cotton Kurta (copy)' })),
    })
    const { router, user } = renderApp('/products')
    await user.click(await screen.findByRole('button', { name: 'Actions for Cotton Kurta' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/products/${copy}`))
  })

  it('offers a viewer only Edit and View', async () => {
    fakeApi({ ...session(['dashboard:read', 'products:read', 'catalog:read']), 'GET /admin/products': () => page([row({ status: 'draft' })]) })
    const { user } = renderApp('/products')
    await user.click(await screen.findByRole('button', { name: 'Actions for Cotton Kurta' }))
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['Edit', 'View on storefront'])
    expect(screen.queryByRole('link', { name: 'New product' })).toBeNull()
  })
})
