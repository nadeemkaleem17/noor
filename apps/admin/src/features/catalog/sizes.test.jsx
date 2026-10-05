import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'
import { pasteBlock } from './components/chart-grid'

afterEach(resetApp)

const u = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-0000000006${String(n).padStart(2, '0')}`
const system = { id: u(1), name: "Women's stitched", values: [{ id: u(2), label: 'S', usedByVariants: 3 }, { id: u(3), label: 'M', usedByVariants: 0 }] }
const chart = { id: u(10), title: 'Kameez', unit: 'in', version: 4, usedBy: 2, updatedAt: '2026-10-05T10:00:00.000Z', tables: [{ id: 'k', title: 'Kameez', columns: ['Bust', 'Waist'], rows: [{ label: 'S', values: [34, 28] }, { label: 'M', values: [36, 30] }] }] }
const formSchema = { id: u(20), title: 'Bridal measurements', allowNotes: true, version: 2, usedBy: 1, updatedAt: '2026-10-05T10:00:00.000Z', fields: [{ key: 'bust', label: 'Bust', type: 'number', required: true, unit: 'in', min: 20, max: 60 }] }
const perms = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'catalog:read', 'catalog:write', 'catalog:delete', 'content:write'])
const session = (/** @type {import('@noor/contract').Permission[]} */ permissions = perms) => ({
  'GET /admin/me': () => json(200, me({ permissions })),
  'GET /admin/size-systems': () => json(200, { items: [system] }),
  'GET /admin/size-charts': () => json(200, { items: [chart] }),
  'GET /admin/form-schemas': () => json(200, { items: [formSchema] }),
})

describe('pasteBlock: a block from a spreadsheet', () => {
  const table = { id: 't', title: '', columns: ['Bust', 'Waist'], rows: [{ label: 'S', values: [undefined, undefined] }] }
  it('fills a 5 by 4 block, adding the rows and columns the table lacks', () => {
    const text = Array.from({ length: 5 }, (_, r) => Array.from({ length: 4 }, (__, c) => String(30 + r * 4 + c)).join('\t')).join('\n')
    const out = pasteBlock(table, 0, 0, `${text}\n`)
    expect(out.rows).toHaveLength(5)
    expect(out.columns).toHaveLength(4)
    expect(out.rows[4]?.values).toEqual([46, 47, 48, 49])
    expect(out.rows[0]?.values).toEqual([30, 31, 32, 33])
  })
  it('starts at the cell it was pasted into and reads commas and blanks', () => {
    const out = pasteBlock({ ...table, rows: [{ label: 'S', values: [1, 2] }, { label: 'M', values: [3, 4] }] }, 1, 1, '36,5\t\nx')
    expect(out.rows[1]?.values).toEqual([3, 36.5, undefined])
    expect(out.rows[2]?.values).toEqual([undefined, undefined])
  })
})

describe('sizes page (plan/07-admin/04-catalog.md section 5)', () => {
  it('keeps the tab in the address and opens a drawer from it', async () => {
    fakeApi(session())
    const { router, user } = renderApp(`/sizes?tab=charts&edit=${u(10)}`)
    expect(await screen.findByRole('dialog', { name: 'Edit Kameez' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(router.state.location.search).toBe('?tab=charts'))
    expect(await screen.findByRole('tab', { name: 'Size charts', selected: true })).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: 'Custom-size forms' }))
    await waitFor(() => expect(router.state.location.search).toBe('?tab=forms'))
    expect(await screen.findByRole('button', { name: 'New custom-size form' })).toBeTruthy()
  })

  describe('size systems', () => {
    it('lists them and refuses to remove a size that variants use', async () => {
      fakeApi(session())
      renderApp(`/sizes?edit=${u(1)}`)
      const drawer = await screen.findByRole('dialog', { name: "Edit Women's stitched" })
      expect((/** @type {HTMLButtonElement} */ (within(drawer).getByRole('button', { name: 'Remove size 1' }))).disabled).toBe(true)
      expect((/** @type {HTMLButtonElement} */ (within(drawer).getByRole('button', { name: 'Remove size 2' }))).disabled).toBe(false)
    })

    it('creates one with ordered sizes', async () => {
      /** @type {any} */
      let sent = null
      fakeApi({ ...session(), 'POST /admin/size-systems': ({ body }) => ((sent = body), json(201, { id: u(9), name: body.name, values: [] })) })
      const { user } = renderApp('/sizes')
      await user.click(await screen.findByRole('button', { name: 'New size system' }))
      const drawer = await screen.findByRole('dialog', { name: 'New size system' })
      await user.type(within(drawer).getByLabelText(/^Name/), 'Footwear EU')
      await user.type(within(drawer).getByLabelText('Size 1'), '36')
      await user.click(within(drawer).getByRole('button', { name: 'Add a size' }))
      await user.type(within(drawer).getByLabelText('Size 2'), '37')
      await user.click(within(drawer).getByRole('button', { name: 'Move size 2 up' }))
      await user.click(within(drawer).getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(sent).toEqual({ name: 'Footwear EU', values: [{ label: '37' }, { label: '36' }] }))
    })

    it('says what blocks a delete', async () => {
      fakeApi({ ...session(), [`DELETE /admin/size-systems/${u(1)}`]: () => problem(409, 'in_use', { usedBy: { options: 2 } }) })
      const { user } = renderApp('/sizes')
      await user.click(await screen.findByRole('button', { name: "Actions for Women's stitched" }))
      await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
      await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
      expect((await screen.findAllByText('It is used by 2 product options, so it cannot be deleted.')).length).toBeGreaterThan(0)
    })
  })

  describe('size charts', () => {
    it('edits a table in the grid: Enter moves down, and the stored version is saved', async () => {
      /** @type {any} */
      let sent = null
      fakeApi({ ...session(), [`PUT /admin/size-charts/${u(10)}`]: ({ body }) => ((sent = body), json(200, chart)) })
      const { user } = renderApp(`/sizes?tab=charts&edit=${u(10)}`)
      const drawer = await screen.findByRole('dialog', { name: 'Edit Kameez' })
      const bustS = within(drawer).getByLabelText('S, Bust')
      await user.clear(bustS)
      await user.type(bustS, '34.5{Enter}')
      expect(document.activeElement).toBe(within(drawer).getByLabelText('M, Bust'))
      await user.keyboard('{ArrowRight}') // the caret is at the end of "36": moves to the next column
      expect(document.activeElement).toBe(within(drawer).getByLabelText('M, Waist'))
      await user.click(within(drawer).getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(sent).not.toBeNull())
      expect(sent).toMatchObject({ version: 4, unit: 'in', sizeSystemId: null })
      expect(sent.tables[0].rows[0].values).toEqual([34.5, 28])
    })

    it('fills a pasted block from a spreadsheet', async () => {
      fakeApi(session())
      const { user } = renderApp(`/sizes?tab=charts&edit=${u(10)}`)
      const drawer = await screen.findByRole('dialog', { name: 'Edit Kameez' })
      await user.click(within(drawer).getByLabelText('S, Bust'))
      await user.paste('40\t31\n42\t33\n44\t35')
      await waitFor(() => expect((/** @type {HTMLInputElement} */ (within(drawer).getByLabelText('S, Bust'))).value).toBe('40'))
      expect((/** @type {HTMLInputElement} */ (within(drawer).getByLabelText('M, Waist'))).value).toBe('33')
      expect(within(drawer).getByLabelText('Table 1 row 3 size')).toBeTruthy() // the third pasted row made a new row
    })

    it('does not save with empty cells, and says so', async () => {
      const calls = fakeApi(session())
      const { user } = renderApp(`/sizes?tab=charts&edit=${u(10)}`)
      const drawer = await screen.findByRole('dialog', { name: 'Edit Kameez' })
      await user.clear(within(drawer).getByLabelText('S, Waist'))
      await user.click(within(drawer).getByRole('button', { name: 'Save' }))
      expect((await within(drawer).findByRole('alert')).textContent).toContain('Every row needs a size and a number in every column')
      expect(calls.some((c) => c.startsWith('PUT'))).toBe(false)
    })

    it('starts a new table with the rows of the size system', async () => {
      fakeApi(session())
      const { user } = renderApp('/sizes?tab=charts')
      await user.click(await screen.findByRole('button', { name: 'New size chart' }))
      const drawer = await screen.findByRole('dialog', { name: 'New size chart' })
      await user.selectOptions(within(drawer).getByLabelText(/^Size system/), "Women's stitched")
      await user.click(within(drawer).getByRole('button', { name: 'Add a table' }))
      expect((/** @type {HTMLInputElement} */ (within(drawer).getByLabelText('Table 2 row 1 size'))).value).toBe('S')
      expect((/** @type {HTMLInputElement} */ (within(drawer).getByLabelText('Table 2 row 2 size'))).value).toBe('M')
    })

    it('says what blocks a delete', async () => {
      fakeApi({ ...session(), [`DELETE /admin/size-charts/${u(10)}`]: () => problem(409, 'in_use', { usedBy: { products: 2 } }) })
      const { user } = renderApp('/sizes?tab=charts')
      await user.click(await screen.findByRole('button', { name: 'Actions for Kameez' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
      await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
      expect((await screen.findAllByText('It is used by 2 products, so it cannot be deleted.')).length).toBeGreaterThan(0)
    })
  })

  describe('custom-size forms', () => {
    it('keeps the key of a stored field fixed and shows a live preview', async () => {
      fakeApi(session())
      const { user } = renderApp(`/sizes?tab=forms&edit=${u(20)}`)
      const drawer = await screen.findByRole('dialog', { name: 'Edit Bridal measurements' })
      expect((/** @type {HTMLInputElement} */ (within(drawer).getByLabelText(/^Key/))).readOnly).toBe(true)
      const preview = within(drawer).getByRole('group', { name: 'Preview of the form' })
      expect(within(preview).getByText('Anything else?')).toBeTruthy()
      await user.clear(within(drawer).getByLabelText(/^Label/))
      await user.type(within(drawer).getByLabelText(/^Label/), 'Chest')
      expect(within(preview).getByText('Chest')).toBeTruthy()
    })

    it('creates a form: keys come from labels, a choice field gets its options, number settings are kept', async () => {
      /** @type {any} */
      let sent = null
      fakeApi({ ...session(), 'POST /admin/form-schemas': ({ body }) => ((sent = body), json(201, { ...formSchema, ...body, id: u(29) })) })
      const { user } = renderApp('/sizes?tab=forms')
      await user.click(await screen.findByRole('button', { name: 'New custom-size form' }))
      const drawer = await screen.findByRole('dialog', { name: 'New custom-size form' })
      await user.type(within(drawer).getByLabelText(/^Title/), 'Lehnga fit')
      await user.type(within(drawer).getByLabelText(/^Label/), 'Waist size')
      await user.type(within(drawer).getByLabelText('Min'), '20')
      await user.click(within(drawer).getByRole('button', { name: 'Add a field' }))
      const labels = within(drawer).getAllByLabelText(/^Label/)
      await user.type(labels[1] ?? drawer, 'Fit style')
      await user.selectOptions(within(drawer).getAllByLabelText(/^Type/)[1] ?? drawer, 'select')
      await user.type(within(drawer).getByLabelText(/^Choices/), 'Fitted\nA-line')
      await user.click(within(drawer).getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(sent).not.toBeNull())
      expect(sent.title).toBe('Lehnga fit')
      expect(sent.fields[0]).toMatchObject({ key: 'waistSize', label: 'Waist size', type: 'number', required: true, unit: 'in', min: 20 })
      expect(sent.fields[1]).toMatchObject({ key: 'fitStyle', type: 'select', options: [{ value: 'fitted', label: 'Fitted' }, { value: 'a_line', label: 'A-line' }] })
      expect(sent.fields[1]).not.toHaveProperty('unit')
    })

    it('says what blocks a delete', async () => {
      fakeApi({ ...session(), [`DELETE /admin/form-schemas/${u(20)}`]: () => problem(409, 'in_use', { usedBy: { products: 1 } }) })
      const { user } = renderApp('/sizes?tab=forms')
      await user.click(await screen.findByRole('button', { name: 'Actions for Bridal measurements' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
      await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
      expect((await screen.findAllByText('It is used by 1 product, so it cannot be deleted.')).length).toBeGreaterThan(0)
    })
  })

  it('shows a viewer the lists without any add or delete controls', async () => {
    fakeApi(session(['dashboard:read', 'catalog:read']))
    renderApp('/sizes')
    await screen.findByRole('region', { name: 'Size systems' })
    expect(screen.queryByRole('button', { name: 'New size system' })).toBeNull()
  })
})
