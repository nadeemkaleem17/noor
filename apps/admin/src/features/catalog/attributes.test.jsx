import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const u = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-0000000005${String(n).padStart(2, '0')}`
const fabric = {
  id: u(1), code: 'fabric', label: 'Fabric', type: 'enum', display: 'checkbox', filterable: true, group: 'Material', usedByProducts: 5, usedByCategories: 1,
  values: [{ id: u(2), code: 'cotton', label: 'Cotton', usedByProducts: 4 }, { id: u(3), code: 'lawn', label: 'Lawn', usedByProducts: 0 }, { id: u(4), code: 'silk', label: 'Silk', usedByProducts: 1 }],
}
const pieces = { id: u(5), code: 'pieces', label: 'Pieces', type: 'number', display: 'range', filterable: true, usedByProducts: 0, usedByCategories: 0, values: [] }
const perms = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'catalog:read', 'catalog:write', 'catalog:delete'])
const session = (/** @type {import('@noor/contract').Permission[]} */ permissions = perms) => ({
  'GET /admin/me': () => json(200, me({ permissions })),
  'GET /admin/attributes': () => json(200, { items: [fabric, pieces] }),
})

describe('attributes (plan/07-admin/04-catalog.md section 4)', () => {
  it('lists them with type, display, value count and use', async () => {
    fakeApi(session())
    renderApp('/attributes')
    const table = await screen.findByRole('region', { name: 'Attributes' })
    const rows = within(table).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent))
    expect(rows[0]?.slice(1, 8)).toEqual(['FabricMaterial', 'fabric', 'Enum', 'Checkbox', '3', 'Yes', '5 products'])
    expect(rows[1]?.slice(1, 4)).toEqual(['Pieces', 'pieces', 'Number'])
  })

  it('creates an enum attribute: the key and value codes follow the labels', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({ ...session(), 'POST /admin/attributes': ({ body }) => ((sent = body), json(201, { ...fabric, ...body, id: u(9), values: [], usedByProducts: 0, usedByCategories: 0 })) })
    const { user } = renderApp('/attributes')
    await user.click(await screen.findByRole('button', { name: 'New attribute' }))
    const drawer = await screen.findByRole('dialog', { name: 'New attribute' })
    await user.type(within(drawer).getByLabelText(/^Label/), 'Dress Length')
    expect((/** @type {HTMLInputElement} */ (within(drawer).getByLabelText(/^Key/))).value).toBe('dress_length')
    await user.click(within(drawer).getByRole('button', { name: 'Add a value' }))
    await user.type(within(drawer).getByLabelText('Value 1'), 'Pure Cotton')
    await user.click(within(drawer).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent).toMatchObject({ code: 'dress_length', label: 'Dress Length', type: 'enum', display: 'checkbox', filterable: true, values: [{ code: 'pure_cotton', label: 'Pure Cotton' }] })
  })

  it('fixes the key and type of a stored attribute, and a value that products use cannot be removed', async () => {
    fakeApi(session())
    renderApp(`/attributes?edit=${u(1)}`)
    const drawer = await screen.findByRole('dialog', { name: 'Edit Fabric' })
    expect((/** @type {HTMLInputElement} */ (within(drawer).getByLabelText(/^Key/))).readOnly).toBe(true)
    expect((/** @type {HTMLSelectElement} */ (within(drawer).getByLabelText(/^Type/))).disabled).toBe(true)
    expect((/** @type {HTMLButtonElement} */ (within(drawer).getByRole('button', { name: 'Remove value 1' }))).disabled).toBe(true)
    expect((/** @type {HTMLButtonElement} */ (within(drawer).getByRole('button', { name: 'Remove value 2' }))).disabled).toBe(false)
    expect(within(drawer).getByText(/Used by 4 products/)).toBeTruthy()
  })

  it('only offers displays that fit the type', async () => {
    fakeApi(session())
    const { user } = renderApp('/attributes')
    await user.click(await screen.findByRole('button', { name: 'New attribute' }))
    const drawer = await screen.findByRole('dialog', { name: 'New attribute' })
    const display = () => within(within(drawer).getByLabelText(/^Filter display/)).getAllByRole('option').map((o) => o.textContent)
    expect(display()).toEqual(['Checkbox', 'Buttons'])
    await user.selectOptions(within(drawer).getByLabelText(/^Type/), 'color')
    expect(display()).toEqual(['Checkbox', 'Swatch', 'Buttons'])
    await user.selectOptions(within(drawer).getByLabelText(/^Type/), 'number')
    expect(display()).toEqual(['Range'])
    expect(within(drawer).queryByRole('button', { name: 'Add a value' })).toBeNull()
  })

  it('saves a change to a stored attribute with its values, ids kept', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({ ...session(), [`PUT /admin/attributes/${u(1)}`]: ({ body }) => ((sent = body), json(200, fabric)) })
    const { user } = renderApp(`/attributes?edit=${u(1)}`)
    const drawer = await screen.findByRole('dialog', { name: 'Edit Fabric' })
    await user.click(within(drawer).getByRole('button', { name: 'Move value 3 up' }))
    await user.click(within(drawer).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent.values.map((/** @type {any} */ v) => [v.id, v.code])).toEqual([[u(2), 'cotton'], [u(4), 'silk'], [u(3), 'lawn']])
    expect(sent).not.toHaveProperty('version')
  })

  it('merges a value into another', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({ ...session(), [`POST /admin/attributes/${u(1)}/values/${u(4)}/merge`]: ({ body }) => ((sent = body), json(204)) })
    const { user } = renderApp(`/attributes?edit=${u(1)}`)
    const drawer = await screen.findByRole('dialog', { name: 'Edit Fabric' })
    const row = within(drawer).getAllByRole('button', { name: 'Merge into…' })[1] // Silk
    await user.click(/** @type {HTMLElement} */ (row))
    const dialog = await screen.findByRole('dialog', { name: 'Merge Silk into…' })
    await user.selectOptions(within(dialog).getByLabelText('Merge into'), 'Cotton')
    await user.click(within(dialog).getByRole('button', { name: 'Merge' }))
    await waitFor(() => expect(sent).toEqual({ intoValueId: u(2) }))
  })

  it('says what blocks a delete', async () => {
    fakeApi({ ...session(), [`DELETE /admin/attributes/${u(1)}`]: () => problem(409, 'in_use', { usedBy: { products: 5, categories: 1 } }) })
    const { user } = renderApp('/attributes')
    await user.click(await screen.findByRole('button', { name: 'Actions for Fabric' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('5 products and 1 categories use it')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect((await screen.findAllByText('It is used by 5 products and 1 category, so it cannot be deleted.')).length).toBeGreaterThan(0)
  })

  it('shows a viewer the list without add or delete', async () => {
    fakeApi(session(['dashboard:read', 'catalog:read']))
    const { user } = renderApp('/attributes')
    await screen.findByRole('region', { name: 'Attributes' })
    expect(screen.queryByRole('button', { name: 'New attribute' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Actions for Fabric' }))
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual(['View'])
  })
})
