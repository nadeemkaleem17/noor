import { PageQuery, csv, z } from '@noor/contract'
import { queryOptions } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithApp, resetApp } from '@/test/app'
import { DataTable } from './data-table'

afterEach(resetApp)

/** @typedef {{ id: string; name: string; status: string; }} Row */

const schema = PageQuery.extend({ status: z.enum(['draft', 'active']).optional(), tag: csv(z.string()).optional() })
/** @type {import('./data-table').Column<Row>[]} */
const columns = [
  { id: 'name', header: 'Name', sortable: true, cell: (r) => r.name },
  { id: 'status', header: 'Status', sortable: true, cell: (r) => r.status },
  { id: 'note', header: 'Note', hideable: true, cell: () => 'n/a' },
]
/** @type {import('./list-filters').FilterDef[]} */
const filters = [
  { key: 'status', label: 'Status', type: 'select', options: [{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }] },
  { key: 'tag', label: 'Tag', type: 'multi', options: [{ value: 'red', label: 'Red' }, { value: 'blue', label: 'Blue' }] },
]

/** @param {number} n @param {number} [from] */
const makeRows = (n, from = 1) => Array.from({ length: n }, (_, i) => ({ id: `r${from + i}`, name: `Item ${from + i}`, status: 'draft' }))

/**
 * A table over an in-memory "server": records the params of every request.
 * @param {{ rows?: Row[]; total?: number; fail?: boolean; }} [data]
 */
function setup({ rows = makeRows(3), total = rows.length, fail = false } = {}) {
  /** @type {any[]} */
  const requests = []
  const query = (/** @type {any} */ params) =>
    queryOptions({
      queryKey: ['rows', params],
      queryFn: async () => {
        requests.push(params)
        if (fail) throw new Error('down')
        return { items: rows, total, page: params.page, size: params.size }
      },
    })
  return { requests, query }
}

/** @param {Partial<import('react').ComponentProps<typeof DataTable<Row>>>} props */
const table = (props) => (
  <DataTable
    id="rows"
    label="Items"
    schema={schema}
    columns={columns}
    filters={filters}
    defaultSort="-name"
    rowId={(r) => r.id}
    rowLabel={(r) => r.name}
    rowHref={(r) => `/items/${r.id}`}
    empty={{ title: 'No items yet' }}
    {...props}
    query={/** @type {any} */ (props.query)}
  />
)

describe('DataTable: reading and URL state (plan/07-admin/14-tables-bulk.md section 3)', () => {
  it('lists the rows with a count, a caption and a real link in the first cell', async () => {
    const { query } = setup({ rows: makeRows(3), total: 2310 })
    renderWithApp(table({ query }))
    expect(await screen.findByRole('link', { name: 'Item 1' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Item 1' }).getAttribute('href')).toBe('/items/r1')
    expect(screen.getByText('1–3 of 2,310')).toBeTruthy()
    expect(document.querySelector('caption')?.textContent).toBe('Items')
  })

  it('restores search, filters, sort, page and page size from the address, and drops values that do not parse', async () => {
    const { query, requests } = setup()
    renderWithApp(table({ query }), { path: '/?q=ab&status=draft&sort=name&page=3&size=25&tag=red,blue' })
    await screen.findByRole('link', { name: 'Item 1' })
    expect(requests.at(-1)).toMatchObject({ q: 'ab', status: 'draft', sort: 'name', page: 3, size: 25, tag: ['red', 'blue'] })
  })

  it('drops values that do not parse', async () => {
    const { query, requests } = setup()
    renderWithApp(table({ query }), { path: '/?page=abc&status=bogus&size=7&extra=1' })
    await screen.findByRole('link', { name: 'Item 1' })
    expect(requests.at(-1)).toMatchObject({ page: 1, size: 50 })
    expect(requests.at(-1).status).toBeUndefined()
  })

  it('cycles a sortable header ascending, descending, default, and says so with aria-sort', async () => {
    const { query } = setup()
    const { router, user } = renderWithApp(table({ query }))
    await screen.findByRole('link', { name: 'Item 1' })
    const header = () => screen.getByRole('columnheader', { name: /Name/ })
    expect(header().getAttribute('aria-sort')).toBe('descending') // the default sort is -name
    expect(screen.getByRole('columnheader', { name: /Status/ }).getAttribute('aria-sort')).toBe('none')
    expect(screen.getByRole('columnheader', { name: /Note/ }).getAttribute('aria-sort')).toBeNull()

    await user.click(within(header()).getByRole('button'))
    await waitFor(() => expect(header().getAttribute('aria-sort')).toBe('ascending'))
    expect(router.state.location.search).toBe('?sort=name')
    await user.click(within(header()).getByRole('button'))
    await waitFor(() => expect(header().getAttribute('aria-sort')).toBe('descending'))
    expect(router.state.location.search).toBe('?sort=-name')
    await user.click(within(header()).getByRole('button'))
    await waitFor(() => expect(router.state.location.search).toBe(''))
  })

  it('searches after a pause, from two characters, and goes back to page 1', async () => {
    const { query, requests } = setup({ total: 400 })
    const { router, user } = renderWithApp(table({ query }), { path: '/?page=4' })
    await screen.findByRole('link', { name: 'Item 1' })
    const box = screen.getByRole('searchbox')
    await user.type(box, 'a')
    await new Promise((r) => setTimeout(r, 450))
    expect(router.state.location.search).toBe('?page=4') // one character is not a search
    await user.type(box, 'b')
    await waitFor(() => expect(router.state.location.search).toBe('?q=ab'))
    await waitFor(() => expect(requests.at(-1)).toMatchObject({ q: 'ab', page: 1 }))
  })

  it('shows applied filters as chips that can be removed, with Clear all', async () => {
    const { query } = setup()
    const { router, user } = renderWithApp(table({ query }))
    await screen.findByRole('link', { name: 'Item 1' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'draft')
    const chips = await screen.findByRole('list', { name: 'Applied filters' })
    expect(within(chips).getByText('Status: Draft')).toBeTruthy()
    expect(router.state.location.search).toBe('?status=draft')

    await user.click(within(chips).getByRole('button', { name: 'Remove filter Status' }))
    await waitFor(() => expect(router.state.location.search).toBe(''))

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'active')
    await user.click(await screen.findByRole('button', { name: 'Clear all' }))
    await waitFor(() => expect(router.state.location.search).toBe(''))
  })

  it('pages with the address, and changing the page size starts again at page 1', async () => {
    const { query } = setup({ total: 400 })
    const { router, user } = renderWithApp(table({ query }), { path: '/?page=2' })
    await screen.findByRole('link', { name: 'Item 1' })
    await user.click(screen.getByRole('button', { name: 'Page 3' }))
    await waitFor(() => expect(router.state.location.search).toBe('?page=3'))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '100')
    await waitFor(() => expect(router.state.location.search).toBe('?size=100'))
  })

  it('tells an empty list from an empty search', async () => {
    const { query } = setup({ rows: [], total: 0 })
    const { user } = renderWithApp(table({ query }))
    expect(await screen.findByText('No items yet')).toBeTruthy()
    resetApp()
    const filtered = setup({ rows: [], total: 0 })
    const { router, user: user2 } = renderWithApp(table({ query: filtered.query }), { path: '/?status=draft' })
    expect(await screen.findByText('No results')).toBeTruthy()
    await user2.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(router.state.location.search).toBe(''))
    void user
  })

  it('shows an error with Retry and keeps the toolbar', async () => {
    const { query } = setup({ fail: true })
    renderWithApp(table({ query }))
    expect(await screen.findByText('Items could not be loaded', {}, { timeout: 15_000 })).toBeTruthy()
    expect(screen.getByRole('searchbox')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  }, 30_000)

  it('hides a column and remembers it', async () => {
    const { query } = setup()
    const { user } = renderWithApp(table({ query }))
    await screen.findByRole('link', { name: 'Item 1' })
    expect(screen.getByRole('columnheader', { name: 'Note' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Columns' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Note' }))
    await waitFor(() => expect(screen.queryByRole('columnheader', { name: 'Note' })).toBeNull())
    expect(JSON.parse(localStorage.getItem('noor.admin.prefs') ?? '{}').tables.rows.hidden).toEqual(['note'])
  })
})

/** @param {Partial<import('./bulk-bar').BulkAction> & { run: import('./bulk-bar').BulkAction['run'] }} action */
const bulk = (action) => ({ id: 'publish', label: 'Publish', done: (/** @type {number} */ n) => `${n} published`, ...action })

describe('DataTable: bulk actions (plan/07-admin/14-tables-bulk.md section 5)', () => {
  it('sends one request for the selected rows and reports it', async () => {
    const { query } = setup({ rows: makeRows(5) })
    const run = vi.fn(async (/** @type {any} */ target) => ({ succeeded: target.ids, failed: [] }))
    const { user } = renderWithApp(table({ query, bulkActions: [bulk({ run })] }))
    await screen.findByRole('link', { name: 'Item 1' })
    for (const n of [1, 2, 3]) await user.click(screen.getByRole('checkbox', { name: `Select Item ${n}` }))
    expect((await screen.findByRole('toolbar', { name: 'Bulk actions' })).textContent).toContain('3 selected')
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByText('3 published')).toBeTruthy()
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith({ ids: ['r1', 'r2', 'r3'] })
    expect(screen.queryByRole('toolbar', { name: 'Bulk actions' })).toBeNull() // succeeded rows leave the selection
  })

  it('selects a range with Shift', async () => {
    const { query } = setup({ rows: makeRows(6) })
    const { user } = renderWithApp(table({ query, bulkActions: [bulk({ run: async () => ({ succeeded: [], failed: [] }) })] }))
    await screen.findByRole('link', { name: 'Item 1' })
    await user.click(screen.getByRole('checkbox', { name: 'Select Item 2' }))
    await user.keyboard('{Shift>}')
    await user.click(screen.getByRole('checkbox', { name: 'Select Item 5' }))
    await user.keyboard('{/Shift}')
    expect((await screen.findByRole('toolbar')).textContent).toContain('4 selected')
  })

  it('"Select all N matching" sends the filter and the total, not the ids', async () => {
    const { query } = setup({ rows: makeRows(3), total: 2310 })
    const run = vi.fn(async () => ({ jobId: 'job-1' }))
    const { user } = renderWithApp(table({ query, bulkActions: [bulk({ run })], getJob: async () => ({ state: 'done', result: { succeeded: ['r1'], failed: [] } }) }), { path: '/?status=draft' })
    await screen.findByRole('link', { name: 'Item 1' })
    await user.click(screen.getByRole('checkbox', { name: 'Select this page' }))
    await user.click(await screen.findByRole('button', { name: 'Select all 2,310 matching this filter' }))
    expect((await screen.findByRole('toolbar')).textContent).toContain('2,310 selected (all matching the filters)')
    await user.click(screen.getByRole('button', { name: 'Publish' })) // more than 50: asks first
    await user.click(await screen.findByRole('button', { name: 'Publish', description: undefined }))
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith({ filter: { q: undefined, status: 'draft', tag: undefined }, expectedTotal: 2310 })
  })

  it('follows a background job and reports its result', async () => {
    const { query } = setup({ rows: makeRows(3), total: 900 })
    const states = [{ state: /** @type {const} */ ('running') }, { state: /** @type {const} */ ('done'), result: { succeeded: Array.from({ length: 898 }, (_, i) => `x${i}`), failed: [{ id: 'r2', code: 'publish_checks_failed', detail: 'Missing image alt text' }, { id: 'r3', code: 'not_found' }] } }]
    const getJob = vi.fn(async () => /** @type {any} */ (states.shift() ?? states[0]))
    const { user } = renderWithApp(table({ query, bulkActions: [bulk({ run: async () => ({ jobId: 'job-1' }) })], getJob }))
    await screen.findByRole('link', { name: 'Item 1' })
    await user.click(screen.getByRole('checkbox', { name: 'Select this page' }))
    await user.click(await screen.findByRole('button', { name: /Select all 900/ }))
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    await user.click(await screen.findByRole('button', { name: 'Publish', description: undefined }))
    expect(await screen.findByText('Working on 900 items…')).toBeTruthy()
    expect(await screen.findByText('898 done, 2 failed', {}, { timeout: 10_000 })).toBeTruthy()
    expect(getJob.mock.calls.length).toBeGreaterThanOrEqual(2)
  }, 30_000)

  it('keeps the failed rows selected and lists why they failed', async () => {
    const { query } = setup({ rows: makeRows(4) })
    const run = async () => ({ succeeded: ['r1', 'r2'], failed: [{ id: 'r3', code: 'publish_checks_failed', detail: 'Missing image alt text' }, { id: 'r4', code: 'forbidden' }] })
    const { user } = renderWithApp(table({ query, bulkActions: [bulk({ run })] }))
    await screen.findByRole('link', { name: 'Item 1' })
    await user.click(screen.getByRole('checkbox', { name: 'Select this page' }))
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByText('2 done, 2 failed')).toBeTruthy()
    expect((await screen.findByRole('toolbar')).textContent).toContain('2 selected')
    expect(/** @type {HTMLInputElement} */ (screen.getByRole('checkbox', { name: 'Select Item 3' })).getAttribute('aria-checked')).toBe('true')
    expect(/** @type {HTMLInputElement} */ (screen.getByRole('checkbox', { name: 'Select Item 1' })).getAttribute('aria-checked')).toBe('false')

    await user.click(screen.getByRole('button', { name: 'View failures' }))
    const dialog = await screen.findByRole('dialog', { name: 'Some items failed' })
    expect(within(dialog).getByRole('link', { name: 'Item 3' }).getAttribute('href')).toBe('/items/r3')
    expect(within(dialog).getByText('Missing image alt text')).toBeTruthy()
    expect(within(dialog).getByText('You do not have permission to do that.')).toBeTruthy()
  })

  it('opens the failures straight away when everything failed', async () => {
    const { query } = setup({ rows: makeRows(2) })
    const run = async () => ({ succeeded: [], failed: [{ id: 'r1', code: 'not_found' }, { id: 'r2', code: 'not_found' }] })
    const { user } = renderWithApp(table({ query, bulkActions: [bulk({ run })] }))
    await screen.findByRole('link', { name: 'Item 1' })
    await user.click(screen.getByRole('checkbox', { name: 'Select this page' }))
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByRole('dialog', { name: 'Some items failed' })).toBeTruthy()
  })

  it('asks before a destructive action, and wants the count typed above 20 items', async () => {
    const { query } = setup({ rows: makeRows(25) })
    const run = vi.fn(async (/** @type {any} */ target) => ({ succeeded: target.ids, failed: [] }))
    const { user } = renderWithApp(table({ query, bulkActions: [bulk({ id: 'delete', label: 'Delete', destructive: true, done: (n) => `${n} deleted`, run })] }))
    await screen.findByRole('link', { name: 'Item 1' })
    await user.click(screen.getByRole('checkbox', { name: 'Select this page' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    const confirm = within(dialog).getByRole('button', { name: 'Delete' })
    expect(/** @type {HTMLButtonElement} */ (confirm).disabled).toBe(true)
    expect(run).not.toHaveBeenCalled()
    await user.type(within(dialog).getByRole('textbox'), '25')
    await user.click(confirm)
    expect(await screen.findByText('25 deleted')).toBeTruthy()
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('does not show an action the role may not perform', async () => {
    const { query } = setup()
    const run = async () => ({ succeeded: [], failed: [] })
    const { user } = renderWithApp(table({ query, bulkActions: [bulk({ run, permission: 'products:publish' }), bulk({ id: 'x', label: 'Archive', run, permission: 'products:write' })] }), { permissions: ['products:read', 'products:write'] })
    await screen.findByRole('link', { name: 'Item 1' })
    await user.click(screen.getByRole('checkbox', { name: 'Select Item 1' }))
    const bar = await screen.findByRole('toolbar')
    expect(within(bar).queryByRole('button', { name: 'Publish' })).toBeNull()
    expect(within(bar).getByRole('button', { name: 'Archive' })).toBeTruthy()
  })

  it('drops the selection when the search or a filter changes, but not when the page does', async () => {
    const { query } = setup({ rows: makeRows(3), total: 100 })
    const { user, router } = renderWithApp(table({ query, bulkActions: [bulk({ run: async () => ({ succeeded: [], failed: [] }) })] }))
    await screen.findByRole('link', { name: 'Item 1' })
    await user.click(screen.getByRole('checkbox', { name: 'Select Item 1' }))
    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    expect((await screen.findByRole('toolbar')).textContent).toContain('1 selected')
    // the bar replaces the filters while rows are selected; a search or filter that arrives by the address (Back, a link) still empties it
    await router.navigate('/?page=2&status=draft')
    await waitFor(() => expect(screen.queryByRole('toolbar')).toBeNull())
  })
})
