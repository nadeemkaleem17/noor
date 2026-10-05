import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { categoriesAnswer, fakeApi, ids2, json, me, problem, productFixture, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const u = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-0000000001${String(n).padStart(2, '0')}`
const system = { id: u(1), name: "Women's stitched", values: ['S', 'M', 'L'].map((label, i) => ({ id: u(10 + i), label, usedByVariants: 0 })) }
const pkr = (/** @type {number} */ amount) => ({ amount, currency: 'PKR' })

const session = (/** @type {Parameters<typeof me>[0]} */ over = {}) => ({
  'GET /admin/me': () => json(200, me({ permissions: ['dashboard:read', 'products:read', 'products:write', 'products:publish', 'inventory:adjust', 'catalog:read'], ...over })),
  'GET /admin/categories': categoriesAnswer,
  'GET /admin/size-systems': () => json(200, { items: [system] }),
  'POST /admin/products/publish-checks': () => json(200, { checks: [] }),
})

/** A stored product with sizes S and M, each a variant. @param {Record<string, unknown>} [over] */
const sized = (over = {}) =>
  productFixture({
    options: [{ id: u(20), name: 'Size', role: 'size', display: 'buttons', sizeSystemId: system.id, values: [{ id: u(21), key: 's', label: 'S', kind: 'standard', sizeSystemValueId: u(10) }, { id: u(22), key: 'm', label: 'M', kind: 'standard', sizeSystemValueId: u(11) }] }],
    variants: [
      { id: u(31), key: 'vs', sku: 'KURTA-S', optionValueKeys: ['s'], price: pkr(349000), stockMode: 'counted', maxPerOrder: 10, enabled: true, stockStatus: 'in_stock', onHand: 4, reserved: 1, hasOrders: false },
      { id: u(32), key: 'vm', sku: 'KURTA-M', optionValueKeys: ['m'], price: pkr(349000), stockMode: 'counted', maxPerOrder: 10, enabled: true, stockStatus: 'in_stock', onHand: 9, reserved: 0, hasOrders: false },
    ],
    ...over,
  })

const open = `/admin/products/${ids2.product}`

describe('options and variants (plan/07-admin/03-products.md section 7)', () => {
  it('builds sizes and variants for a new product and sends opening stock with the create', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({
      ...session(),
      'POST /admin/products': ({ body }) => {
        sent = body
        return json(201, sized({ version: 1 }))
      },
      [`GET ${open}`]: () => json(200, sized({ version: 1 })),
      'GET /admin/products/sku-available': () => json(200, { available: true }),
    })
    const { user } = renderApp('/products/new')
    await user.type(await screen.findByLabelText(/^Title/), 'Cotton Kurta')
    await user.selectOptions(screen.getByLabelText(/Primary category/), 'Women › Stitched')
    await user.click(screen.getByRole('button', { name: 'Add an option' }))
    await user.type(screen.getByLabelText(/^Name/), 'Size')
    await user.selectOptions(screen.getByLabelText(/^Role/), 'size')
    await user.selectOptions(await screen.findByLabelText(/Size system/), "Women's stitched")
    await user.click(await screen.findByRole('checkbox', { name: 'S' }))
    await user.click(screen.getByRole('checkbox', { name: 'M' }))
    await user.click(screen.getByRole('button', { name: 'Generate variants' }))

    const table = await screen.findByRole('region', { name: 'Variants' })
    expect(within(table).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0]?.textContent)).toEqual(['S', 'M'])
    for (const [label, sku, price, stock] of [['S', 'KURTA-S', '3490', '4'], ['M', 'KURTA-M', '3490', '9']]) {
      await user.type(within(table).getByLabelText(`SKU ${label}`), String(sku))
      await user.type(within(table).getByLabelText(`Price ${label}`), String(price))
      await user.type(within(table).getByLabelText(`Opening stock ${label}`), String(stock))
    }
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0] ?? table)
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent.options).toHaveLength(1)
    expect(sent.options[0].values.map((/** @type {any} */ v) => [v.label, v.sizeSystemValueId])).toEqual([['S', u(10)], ['M', u(11)]])
    expect(sent.variants.map((/** @type {any} */ v) => [v.sku, v.price.amount, v.optionValueKeys.length])).toEqual([['KURTA-S', 349000, 1], ['KURTA-M', 349000, 1]])
    expect(sent.initialStock).toEqual([{ variantKey: sent.variants[0].key, quantity: 4 }, { variantKey: sent.variants[1].key, quantity: 9 }])
    expect(sent.variants[0]).not.toHaveProperty('onHand')
  })

  it('adding a size generates only the new variant and keeps the SKUs, prices and stock that exist', async () => {
    fakeApi({ ...session(), [`GET ${open}`]: () => json(200, sized()) })
    const { user } = renderApp(`/products/${ids2.product}`)
    await user.click(await screen.findByRole('checkbox', { name: 'L' }))
    await user.click(screen.getByRole('button', { name: 'Generate variants' }))
    const table = await screen.findByRole('region', { name: 'Variants' })
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(4))
    expect((within(table).getByLabelText('SKU S') /** @type {HTMLInputElement} */ ).getAttribute('value') ?? (/** @type {HTMLInputElement} */ (within(table).getByLabelText('SKU S'))).value).toBe('KURTA-S')
    expect((/** @type {HTMLInputElement} */ (within(table).getByLabelText('SKU L'))).value).toBe('')
    expect((/** @type {HTMLInputElement} */ (within(table).getByLabelText('Price M'))).value).toBe('3490.00')
    expect(within(table).getByText('Save first')).toBeTruthy() // the new variant has no stock until it is saved
  })

  it('lists the variants it would remove and waits for a yes', async () => {
    fakeApi({ ...session(), [`GET ${open}`]: () => json(200, sized()) })
    const { user } = renderApp(`/products/${ids2.product}`)
    await user.click(await screen.findByRole('checkbox', { name: 'S' }))
    await user.click(screen.getByRole('button', { name: 'Generate variants' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Remove variants?' })
    expect(dialog.textContent).toContain('KURTA-S')
    await user.click(within(dialog).getByRole('button', { name: 'Remove them' }))
    const table = await screen.findByRole('region', { name: 'Variants' })
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(2))
    expect(within(table).queryByLabelText('SKU S')).toBeNull()
  })

  it('does not let a size go while a variant that has orders uses it', async () => {
    const product = sized()
    const variants = /** @type {any[]} */ (product.variants)
    fakeApi({ ...session(), [`GET ${open}`]: () => json(200, { ...product, variants: [{ ...variants[0], hasOrders: true }, variants[1]] }) })
    renderApp(`/products/${ids2.product}`)
    const s = await screen.findByRole('checkbox', { name: 'S' })
    expect(s.getAttribute('aria-disabled') ?? (/** @type {HTMLInputElement} */ (s)).disabled).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'M' }).getAttribute('data-disabled')).toBeNull()
  })

  it('adjusts stock through the dialog without making the form unsaved, and explains a refusal', async () => {
    /** @type {any[]} */
    const sent = []
    fakeApi({
      ...session(),
      [`GET ${open}`]: () => json(200, sized()),
      'POST /admin/inventory/adjustments': ({ body }) => {
        sent.push(body)
        return body.quantity > 3 ? problem(409, 'stock_below_reserved', { reserved: 1 }) : json(200, { variantId: body.variantId, onHand: 7, reserved: 1, available: 6, stockStatus: 'in_stock' })
      },
    })
    const { user } = renderApp(`/products/${ids2.product}`)
    await user.click(await screen.findByRole('button', { name: 'Adjust stock S' }))
    const dialog = await screen.findByRole('dialog', { name: 'Adjust stock: KURTA-S' })
    expect(dialog.textContent).toContain('On hand 4, held by open orders 1.')
    await user.selectOptions(within(dialog).getByLabelText(/^Change/), 'remove')
    await user.type(within(dialog).getByLabelText(/^Quantity/), '9')
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }))
    expect((await within(dialog).findByRole('alert')).textContent).toContain('less than the 1 units held by open orders')

    await user.selectOptions(within(dialog).getByLabelText(/^Change/), 'add')
    await user.clear(within(dialog).getByLabelText(/^Quantity/))
    await user.type(within(dialog).getByLabelText(/^Quantity/), '3')
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Adjust stock/ })).toBeNull())
    expect(sent.at(-1)).toMatchObject({ variantId: u(31), mode: 'add', quantity: 3, reason: 'restock' })
    const row = within(screen.getByRole('region', { name: 'Variants' })).getAllByRole('row')[1]
    expect(row?.textContent).toContain('7')
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull()
  })

  it('asks for a note when the reason is damage', async () => {
    fakeApi({ ...session(), [`GET ${open}`]: () => json(200, sized()) })
    const { user } = renderApp(`/products/${ids2.product}`)
    await user.click(await screen.findByRole('button', { name: 'Adjust stock S' }))
    const dialog = await screen.findByRole('dialog', { name: /Adjust stock/ })
    await user.type(within(dialog).getByLabelText(/^Quantity/), '1')
    await user.selectOptions(within(dialog).getByLabelText(/^Reason/), 'damaged')
    expect(/** @type {HTMLButtonElement} */ (within(dialog).getByRole('button', { name: 'Apply' })).disabled).toBe(true)
    await user.type(within(dialog).getByLabelText(/^Note/), 'water damage')
    expect(/** @type {HTMLButtonElement} */ (within(dialog).getByRole('button', { name: 'Apply' })).disabled).toBe(false)
  })

  it('hides Adjust from a role without inventory:adjust', async () => {
    fakeApi({ ...session({ permissions: ['dashboard:read', 'products:read', 'products:write', 'catalog:read'] }), [`GET ${open}`]: () => json(200, sized()) })
    renderApp(`/products/${ids2.product}`)
    await screen.findByRole('region', { name: 'Variants' })
    expect(screen.queryByRole('button', { name: /Adjust stock/ })).toBeNull()
  })

  it('says at once when a SKU is already taken', async () => {
    fakeApi({ ...session(), [`GET ${open}`]: () => json(200, sized()), 'GET /admin/products/sku-available': () => json(200, { available: false }) })
    const { user } = renderApp(`/products/${ids2.product}`)
    const sku = await screen.findByLabelText('SKU M')
    await user.clear(sku)
    await user.type(sku, 'TAKEN-1')
    await user.tab()
    expect(await screen.findByText('This value is already used')).toBeTruthy()
  })

  it('refuses a colour option on a product in a colourway group', async () => {
    fakeApi({ ...session(), [`GET ${open}`]: () => json(200, sized({ styleId: 'kurta-style', colorway: { label: 'Red', family: 'red', swatch: { hex: ['#cc0000'] } } })) })
    renderApp(`/products/${ids2.product}`)
    const role = await screen.findByLabelText(/^Role/)
    expect(within(role).getByRole('option', { name: 'Color' }).hasAttribute('disabled')).toBe(true)
  })
})
