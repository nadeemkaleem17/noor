import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, ids2, json, me, productFixture, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const u = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-0000000003${String(n).padStart(2, '0')}`
const fabric = { id: u(1), code: 'fabric', label: 'Fabric', type: 'enum', display: 'checkbox', filterable: true, usedByProducts: 0, usedByCategories: 1, values: [{ id: u(2), code: 'cotton', label: 'Cotton', usedByProducts: 0 }, { id: u(3), code: 'lawn', label: 'Lawn', usedByProducts: 0 }] }
const cats = {
  items: [
    { id: ids2.cat, name: 'Women', handle: 'women', parentId: null, visible: true, attributes: [{ attributeId: fabric.id, seoIndexable: false, required: true }], sortOrder: 0, productCount: 2, version: 1 },
    { id: ids2.cat2, name: 'Stitched', handle: 'stitched', parentId: ids2.cat, visible: true, attributes: [], sortOrder: 0, productCount: 1, version: 1 },
  ],
}
const session = {
  'GET /admin/me': () => json(200, me({ permissions: ['dashboard:read', 'products:read', 'products:write', 'catalog:read'] })),
  'GET /admin/categories': () => json(200, cats),
  'GET /admin/attributes': () => json(200, { items: [fabric] }),
  'GET /admin/size-systems': () => json(200, { items: [] }),
  'GET /admin/size-charts': () => json(200, { items: [{ id: u(10), title: 'Kameez chart', unit: 'in', tables: [{ id: 'k', title: 'Kameez', columns: ['Bust'], rows: [{ label: 'S', values: [34] }] }], version: 1, usedBy: 0, updatedAt: '2026-10-05T10:00:00.000Z' }] }),
  'GET /admin/form-schemas': () => json(200, { items: [{ id: u(11), title: 'Bridal measurements', fields: [{ key: 'bust', label: 'Bust', type: 'number', required: true }], allowNotes: false, version: 1, usedBy: 0, updatedAt: '2026-10-05T10:00:00.000Z' }] }),
  'POST /admin/products/publish-checks': () => json(200, { checks: [] }),
}
const open = `/admin/products/${ids2.product}`

/** Opens a stored product and returns what the next save sends. @param {Record<string, unknown>} [over] */
function editing(over = {}) {
  /** @type {{ body: any }} */
  const out = { body: null }
  fakeApi({
    ...session,
    [`GET ${open}`]: () => json(200, productFixture(over)),
    [`PUT ${open}`]: ({ body }) => {
      out.body = body
      return json(200, productFixture({ ...body, version: 4 }))
    },
  })
  return out
}
const save = async (/** @type {any} */ user) => user.click(screen.getAllByRole('button', { name: 'Save' })[0])

describe('sections that depend on the type (plan/07-admin/03-products.md section 5)', () => {
  it('unstitched: lists the pieces of the set', async () => {
    const out = editing({ kind: 'unstitched' })
    const { user } = renderApp(`/products/${ids2.product}`)
    await user.click(await screen.findByRole('button', { name: 'Add a piece' }))
    await user.type(screen.getByLabelText(/^Name/, { selector: 'input' }), 'Embroidered shirt')
    await user.type(screen.getByLabelText('Quantity'), '3 m')
    await user.click(screen.getByRole('button', { name: 'Add a piece' }))
    expect(screen.getAllByRole('group', { name: /Piece/ })).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Move piece 2 up' }))
    await user.click(screen.getByRole('button', { name: 'Remove piece 1' }))
    await save(user)
    await waitFor(() => expect(out.body).not.toBeNull())
    expect(out.body.components).toEqual([{ type: 'shirt', label: 'Embroidered shirt', quantity: '3 m', included: true }])
  })

  it('shows only the part that fits the type, and nothing for an accessory', async () => {
    editing({ kind: 'stitched' })
    const { user } = renderApp(`/products/${ids2.product}`)
    expect(await screen.findByRole('heading', { name: 'Sizing', level: 2 })).toBeTruthy()
    const kind = screen.getByRole('combobox', { name: /^Type/ })
    await user.selectOptions(kind, 'made_to_order')
    expect(await screen.findByRole('heading', { name: 'Made to order' })).toBeTruthy()
    expect(screen.getByLabelText('Size chart')).toBeTruthy() // made to order also takes sizing
    await user.selectOptions(kind, 'bundle')
    expect(await screen.findByRole('heading', { name: 'In this set' })).toBeTruthy()
    await user.selectOptions(kind, 'accessory')
    await waitFor(() => expect(document.getElementById('kind')).toBeNull())
  })

  it('stitched: sizing and fit are saved', async () => {
    const out = editing({ kind: 'stitched' })
    const { user } = renderApp(`/products/${ids2.product}`)
    await user.selectOptions(await screen.findByLabelText('Size chart'), 'Kameez chart')
    await user.selectOptions(screen.getByLabelText('Fit'), 'true_to_size')
    await user.type(screen.getByLabelText('Model height (cm)'), '172')
    await save(user)
    await waitFor(() => expect(out.body).not.toBeNull())
    expect(out.body).toMatchObject({ sizeChartId: u(10), fit: { note: 'true_to_size', modelHeightCm: 172 } })
  })

  it('made to order: lead time, wording hint, deposit and the custom-size form', async () => {
    const out = editing({ kind: 'made_to_order' })
    const { user } = renderApp(`/products/${ids2.product}`)
    await user.type(await screen.findByLabelText('Shortest lead time in days'), '15')
    await user.type(screen.getByLabelText('Longest lead time in days'), '20')
    expect(await screen.findByText('Left empty, the shop says "Made for you in 15–20 days".')).toBeTruthy()
    await user.type(screen.getByLabelText(/^Deposit/), '30')
    await user.selectOptions(screen.getByLabelText('Custom-size form'), 'Bridal measurements')
    await save(user)
    await waitFor(() => expect(out.body).not.toBeNull())
    expect(out.body.madeToOrder).toEqual({ leadMinDays: 15, leadMaxDays: 20, returnable: false, depositPercent: 30 })
    expect(out.body.customSizeSchemaId).toBe(u(11))
  })

  it('made to order: a Custom size value can be added to the size option when there is a custom-size form', async () => {
    editing({
      kind: 'made_to_order',
      customSizeSchemaId: u(11),
      options: [{ id: u(20), name: 'Size', role: 'size', display: 'buttons', values: [{ id: u(21), key: 'm', label: 'M', kind: 'standard' }] }],
    })
    const { user } = renderApp(`/products/${ids2.product}`)
    const box = await screen.findByRole('checkbox', { name: /Include a Custom size/ })
    await user.click(box)
    await waitFor(() => expect(/** @type {HTMLElement} */ (box).getAttribute('aria-checked')).toBe('true'))
  })
})

describe('attributes, colourway and related products', () => {
  it('shows the attributes of the primary category, or of its nearest parent that has some', async () => {
    const out = editing({ primaryCategoryId: ids2.cat2 })
    const { user } = renderApp(`/products/${ids2.product}`)
    const group = await screen.findByRole('group', { name: /Fabric/ })
    await user.click(within(group).getByRole('checkbox', { name: 'Cotton' }))
    await user.click(within(group).getByRole('checkbox', { name: 'Lawn' }))
    await user.click(within(group).getByRole('checkbox', { name: 'Cotton' }))
    await save(user)
    await waitFor(() => expect(out.body).not.toBeNull())
    expect(out.body.attributes).toEqual([{ attributeId: fabric.id, valueIds: [u(3)] }])
  })

  it('colourway: the colour fields appear with a style and leave with it', async () => {
    const out = editing()
    const { user } = renderApp(`/products/${ids2.product}`)
    expect(screen.queryByLabelText(/^Colour name/)).toBeNull()
    await user.type(await screen.findByLabelText(/^Style/), 'embroidered-lawn')
    await user.type(await screen.findByLabelText(/^Colour name/), 'Maroon')
    await user.selectOptions(screen.getByLabelText(/^Colour family/), 'red')
    await save(user)
    await waitFor(() => expect(out.body).not.toBeNull())
    expect(out.body).toMatchObject({ styleId: 'embroidered-lawn', colorway: { label: 'Maroon', family: 'red', swatch: { hex: ['#888888'] } } })

    out.body = null
    await user.clear(screen.getByLabelText(/^Style/))
    await save(user)
    await waitFor(() => expect(out.body).not.toBeNull())
    expect(out.body).not.toHaveProperty('colorway')
    expect(out.body).not.toHaveProperty('styleId')
  })

  it('lists the other colours of the style with links', async () => {
    const other = '0194f1b2-7c3a-7000-8000-0000000003f1'
    editing({ styleId: 'kurta', colorway: { label: 'Red', family: 'red', swatch: { hex: ['#cc0000'] } }, siblings: [{ id: other, handle: 'kurta-blue', title: 'Cotton Kurta', colorwayLabel: 'Blue', status: 'active' }] })
    renderApp(`/products/${ids2.product}`)
    const link = await screen.findByRole('link', { name: 'Cotton Kurta (Blue)' })
    expect(link.getAttribute('href')).toBe(`/products/${other}`)
  })

  it('related products are found by search and kept as ids', async () => {
    const other = '0194f1b2-7c3a-7000-8000-0000000003f2'
    const out = editing()
    fakeApi({
      ...session,
      [`GET ${open}`]: () => json(200, productFixture()),
      [`PUT ${open}`]: ({ body }) => {
        out.body = body
        return json(200, productFixture({ ...body, version: 4 }))
      },
      '/admin/products': () => json(200, {}),
      'GET /admin/products': () =>
        json(200, { items: [{ id: other, handle: 'lawn', title: 'Lawn Suit', status: 'active', kind: 'unstitched', primaryCategory: { id: ids2.cat, name: 'Women' }, variantCount: 1, stockStatus: 'in_stock', priceFrom: { amount: 100000, currency: 'PKR' }, updatedAt: '2026-10-05T10:00:00.000Z', hasIssues: false }], total: 1, page: 1, size: 25 }),
    })
    const { user } = renderApp(`/products/${ids2.product}`)
    const box = await screen.findByRole('combobox', { name: 'Related products' })
    await user.type(box, 'lawn')
    await user.click(await screen.findByRole('option', { name: 'Lawn Suit' }, { timeout: 5000 }))
    await save(user)
    await waitFor(() => expect(out.body).not.toBeNull())
    expect(out.body.relatedIds).toEqual([other])
  })
})
