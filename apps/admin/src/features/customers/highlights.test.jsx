import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, renderApp, resetApp } from '@/test/app'
import { customerFixture, customerRowFixture, lookupsAnswer, oid } from '@/test/sales-data'
import { inkOn } from './components/highlight-badges'

afterEach(resetApp)

const reader = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'customers:read', 'orders:read'])
const writer = /** @type {import('@noor/contract').Permission[]} */ ([...reader, 'customers:write'])
/** @param {import('@noor/contract').Permission[]} permissions @param {Record<string, (r: { body: any; headers: Headers; url: URL }) => Response>} [more] */
const session = (permissions, more = {}) => ({
  'GET /admin/me': () => json(200, me({ permissions })),
  'GET /admin/orders/lookups': () => json(200, lookupsAnswer()),
  ...more,
})
const rid = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-0000000007${String(n).padStart(2, '0')}`
const rule = (/** @type {number} */ n, /** @type {object} */ over = {}) => ({ id: rid(n), kind: 'orders', minCount: 1, maxCount: 5, color: '#3b82f6', label: `Rule ${n}`, enabled: true, ...over })

describe('the ink on a colour', () => {
  it('is black on a light colour and white on a dark one, so a label can always be read', () => {
    expect(inkOn('#ffffff')).toBe('#000000')
    expect(inkOn('#f59e0b')).toBe('#000000')
    expect(inkOn('#000000')).toBe('#ffffff')
    expect(inkOn('#1e3a8a')).toBe('#ffffff')
  })
})

describe('colours and visits on the customer list', () => {
  it('shows the colour a rule gave, with its name, and the visits beside the orders', async () => {
    const highlights = [{ ruleId: rid(1), kind: 'orders', label: 'Regular', color: '#f59e0b' }]
    fakeApi(session(reader, {
      'GET /admin/customers': () => json(200, { items: [customerRowFixture({ highlights, visitsCount: 7, lastVisitAt: '2026-10-18T10:00:00.000Z' })], total: 1, page: 1, size: 50 }),
      'GET /admin/customers/highlight-rules': () => json(200, { items: [rule(1, { label: 'Regular' })] }),
    }))
    renderApp('/customers')
    const chip = await screen.findByText('Regular', { selector: 'span.rounded-full' })
    expect(chip.style.backgroundColor).toBe('rgb(245, 158, 11)')
    const table = screen.getByRole('table')
    expect(within(table).getByRole('columnheader', { name: /Visits/ })).toBeTruthy()
    expect(within(table).getByText('7')).toBeTruthy()
    // the filters of this task, the second only because there are rules to filter by
    expect(await screen.findByRole('combobox', { name: 'Visits' })).toBeTruthy()
    expect(await screen.findByRole('combobox', { name: 'Highlight' })).toBeTruthy()
  })

  it('shows the visits of the website without names, and says when none are counted yet', async () => {
    fakeApi(session(reader, {
      'GET /admin/customers': () => json(200, { items: [], total: 0, page: 1, size: 50 }),
      'GET /admin/customers/visit-summary': () => json(200, { visits: 120, visitors: 80, newVisitors: 50, returningVisitors: 30, identifiedVisitors: 6, days: [] }),
    }))
    renderApp('/customers')
    const strip = await screen.findByRole('region', { name: 'Website visits' })
    expect(await within(strip).findByText('120')).toBeTruthy()
    expect(within(strip).getByText('Browsers, not people')).toBeTruthy()
    expect(within(strip).getByText('Became customers').nextElementSibling?.textContent).toMatch(/^6/)
  })

  it('links to the rules for anyone who can read customers', async () => {
    fakeApi(session(reader, { 'GET /admin/customers': () => json(200, { items: [], total: 0, page: 1, size: 50 }) }))
    renderApp('/customers')
    expect((await screen.findByRole('link', { name: 'Highlight rules' })).getAttribute('href')).toBe('/customers/highlights')
  })
})

describe('the customer page', () => {
  it('shows the colours, since when, and the visits with the browsers they came from', async () => {
    fakeApi(session(reader, {
      [`GET /admin/customers/${oid.customer}`]: () =>
        json(200, customerFixture({ highlights: [{ ruleId: rid(2), kind: 'visits', label: 'Repeat visitor', color: '#8b5cf6' }], visitsCount: 4, devices: 2, lastVisitAt: '2026-10-18T10:00:00.000Z', recentVisits: [{ startedAt: '2026-10-18T10:00:00.000Z', landingPath: '/p/lawn-kurta' }] })),
      'GET /admin/orders': () => json(200, { items: [], total: 0, page: 1, size: 50 }),
    }))
    renderApp(`/customers/${oid.customer}`)
    expect(await screen.findByText('Repeat visitor')).toBeTruthy()
    const block = screen.getByRole('region', { name: 'Website visits' })
    expect(within(block).getByText('Visits').nextElementSibling?.textContent).toBe('4')
    expect(within(block).getByText('Browsers').nextElementSibling?.textContent).toBe('2')
    expect(within(block).getByText('/p/lawn-kurta')).toBeTruthy()
    expect(screen.getByText(/Customer since/)).toBeTruthy()
    expect(within(block).getByText(/Orders are counted separately/)).toBeTruthy()
  })
})

describe('the highlight rules screen', () => {
  const two = [rule(1, { label: 'New customer' }), rule(2, { minCount: 6, maxCount: 10, color: '#f59e0b', label: 'Regular' })]

  it('changes a rule, adds one and removes one, and sends the whole list with the ids of the ones it kept', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(session(writer, {
      'GET /admin/customers/highlight-rules': () => json(200, { items: two }),
      'PUT /admin/customers/highlight-rules': ({ body }) => ((sent = body), json(200, { items: [{ ...two[0], label: 'First order' }, { id: rid(3), kind: 'orders', minCount: 11, color: '#16a34a', label: 'Loyal', enabled: true }] })),
    }))
    const { user } = renderApp('/customers/highlights')
    const first = await screen.findByRole('group', { name: /Rule 1/ })
    expect((screen.getByRole('button', { name: 'Save rules' }))).toHaveProperty('disabled', true) // nothing changed yet
    const label = within(first).getByLabelText(/Name shown/)
    await user.clear(label)
    await user.type(label, 'First order')
    await user.click(screen.getByRole('button', { name: 'Delete rule 2' }))
    await user.click(screen.getByRole('button', { name: 'Add a rule' }))
    const added = screen.getByRole('group', { name: /Rule 2/ })
    await user.clear(within(added).getByLabelText(/^From/))
    await user.type(within(added).getByLabelText(/^From/), '11')
    await user.clear(within(added).getByLabelText(/Up to/))
    await user.type(within(added).getByLabelText(/Name shown/), 'Loyal')
    await user.click(screen.getByRole('button', { name: 'Save rules' }))
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent.rules).toEqual([
      { id: rid(1), kind: 'orders', minCount: 1, maxCount: 5, color: '#3b82f6', label: 'First order', enabled: true },
      { kind: 'orders', minCount: 11, color: '#3b82f6', label: 'Loyal', enabled: true },
    ])
    expect((await screen.findAllByText('Highlight rules saved')).length).toBeGreaterThan(0)
  })

  it('starts again from the suggested ranges without saving anything until Save is pressed', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(session(writer, {
      'GET /admin/customers/highlight-rules': () => json(200, { items: [] }),
      'PUT /admin/customers/highlight-rules': ({ body }) => ((sent = body), json(200, { items: [] })),
    }))
    const { user } = renderApp('/customers/highlights')
    await user.click(await screen.findByRole('button', { name: 'Start from the suggested ranges' }))
    expect(sent).toBeNull()
    expect(screen.getAllByRole('group', { name: /Rule \d/ })).toHaveLength(4)
    await user.click(screen.getByRole('button', { name: 'Save rules' }))
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent.rules.map((/** @type {{ label: string; minCount: number; maxCount?: number }} */ r) => [r.label, r.minCount, r.maxCount])).toEqual([
      ['New customer', 1, 5], ['Regular', 6, 10], ['Loyal', 11, undefined], ['Repeat visitor', 2, undefined],
    ])
  })

  it('will not save a range that ends before it begins, says why, and warns when two ranges overlap', async () => {
    fakeApi(session(writer, { 'GET /admin/customers/highlight-rules': () => json(200, { items: two }) }))
    const { user } = renderApp('/customers/highlights')
    const first = await screen.findByRole('group', { name: /Rule 1/ })
    const upTo = within(first).getByLabelText(/Up to/)
    await user.clear(upTo)
    await user.type(upTo, '0')
    expect(await within(first).findByText('The upper number must not be below the lower one.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save rules' })).toHaveProperty('disabled', true)
    await user.clear(upTo)
    await user.type(upTo, '8') // 1 to 8 now reaches into 6 to 10
    expect(await screen.findByText(/overlap: where both fit, "New customer" is used/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save rules' })).toHaveProperty('disabled', false)
  })

  it('lets a rule be switched off without deleting it', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(session(writer, {
      'GET /admin/customers/highlight-rules': () => json(200, { items: two }),
      'PUT /admin/customers/highlight-rules': ({ body }) => ((sent = body), json(200, { items: two })),
    }))
    const { user } = renderApp('/customers/highlights')
    const second = await screen.findByRole('group', { name: /Rule 2/ })
    await user.click(within(second).getByRole('checkbox', { name: 'On' }))
    await user.click(screen.getByRole('button', { name: 'Save rules' }))
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent.rules[1]).toMatchObject({ id: rid(2), enabled: false })
  })

  it('shows a reader the rules and nothing to change them with', async () => {
    fakeApi(session(reader, { 'GET /admin/customers/highlight-rules': () => json(200, { items: two }) }))
    renderApp('/customers/highlights')
    await screen.findByRole('group', { name: /Rule 1/ })
    expect(screen.queryByRole('button', { name: 'Save rules' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add a rule' })).toBeNull()
    expect(screen.getByText('You can see these rules but not change them.')).toBeTruthy()
  })

  it('says so when there are no rules, so nobody is coloured', async () => {
    fakeApi(session(writer, { 'GET /admin/customers/highlight-rules': () => json(200, { items: [] }) }))
    renderApp('/customers/highlights')
    expect(await screen.findByText(/no customer is coloured/)).toBeTruthy()
  })
})
