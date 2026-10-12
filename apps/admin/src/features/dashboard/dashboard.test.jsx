import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'
import { rowFixture } from '@/test/sales-data'
import { addDays, todayIn } from './period'

afterEach(resetApp)

const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })
const kpis = (/** @type {Record<string, unknown>} */ over = {}) => ({ netSales: money(41230000), orders: 64, averageOrder: money(644200), deliveredRate: 0.71, cancelledRate: 0.18, cancelledByReason: { customer_request: 5, refused_at_door: 3 }, ...over })
const summary = (/** @type {Record<string, unknown>} */ over = {}) => ({
  current: kpis(),
  previous: kpis({ netSales: money(36800000), orders: 67, averageOrder: money(625000) }),
  byDay: [{ day: '2026-10-10', sales: money(1500000), orders: 3 }, { day: '2026-10-11', sales: money(0), orders: 0 }, { day: '2026-10-12', sales: money(3200000), orders: 5 }],
  bucket: 'day',
  ...over,
})
const everything = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'orders:read', 'products:read', 'reviews:read', 'audit:read'])
const stockOnly = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'products:read'])
/** @param {import('@noor/contract').Permission[]} permissions @param {Record<string, (r: { body: any; headers: Headers; url: URL }) => Response>} [more] */
const session = (permissions, more = {}) => ({
  'GET /admin/me': () => json(200, me({ permissions })),
  'GET /admin/dashboard/todo': () => json(200, { toConfirm: { count: 12, oldestAt: new Date(Date.now() - 3 * 3_600_000).toISOString() }, toDispatch: { count: 8, oldestAt: new Date(Date.now() - 26 * 3_600_000).toISOString() }, lowStock: { count: 5 }, soldOut: { count: 0 }, reviewsPending: { count: 3 }, failedJobs: { count: 0 } }),
  'GET /admin/dashboard/summary': () => json(200, summary()),
  'GET /admin/dashboard/top-products': () => json(200, { items: [{ productId: '0194f1b2-7c3a-7000-8000-000000000001', title: 'Lawn Suit', units: 14, sales: money(9800000) }] }),
  'GET /admin/dashboard/zero-searches': () => json(200, { items: [{ query: 'kaftan', count: 7 }] }),
  'GET /admin/orders': () => json(200, { items: Array.from({ length: 25 }, (_, i) => rowFixture({ id: `0194f1b2-7c3a-7000-8000-${String(500 + i).padStart(12, '0')}`, orderNumber: `RB-${10500 + i}`, customerName: `Sana Malik ${i}` })), total: 25, page: 1, size: 25 }),
  ...more,
})

describe('dashboard to-do cards (plan/07-admin/02-dashboard.md section 3)', () => {
  it('shows each count with the age of the oldest, links to the list that explains it, and leaves a zero out', async () => {
    fakeApi(session(everything))
    renderApp('/')
    const todo = (await screen.findByRole('heading', { name: 'To do' })).closest('section') ?? document.body
    expect(await within(todo).findByRole('link', { name: /12\s*to confirm/ })).toBeTruthy()
    expect(within(todo).getByRole('link', { name: /12\s*to confirm/ }).getAttribute('href')).toBe('/orders?status=pending_confirmation')
    expect(within(todo).getByRole('link', { name: /8\s*to dispatch/ }).getAttribute('href')).toBe('/orders?status=confirmed')
    expect(within(todo).getByRole('link', { name: /5\s*low stock/ }).getAttribute('href')).toBe('/products?stock=low')
    expect(within(todo).getByRole('link', { name: /3\s*reviews pending/ }).getAttribute('href')).toBe('/reviews?status=pending')
    expect(within(todo).getByText(/oldest 3 h/)).toBeTruthy()
    expect(within(todo).queryByText(/sold out/)).toBeNull()
    expect(within(todo).queryByText(/failed jobs/)).toBeNull()
  })

  it('says so when nothing waits', async () => {
    fakeApi(session(everything, { 'GET /admin/dashboard/todo': () => json(200, { toConfirm: { count: 0 }, lowStock: { count: 0 } }) }))
    renderApp('/')
    expect(await screen.findByText('Nothing waiting. Nice.')).toBeTruthy()
  })
})

describe('dashboard figures (plan/07-admin/02-dashboard.md sections 4 and 5)', () => {
  it('shows the API\'s figures with the change on the period before, and a dash for a rate it does not give yet', async () => {
    fakeApi(session(everything, { 'GET /admin/dashboard/summary': () => json(200, summary({ current: kpis({ deliveredRate: undefined, cancelledRate: undefined, cancelledByReason: undefined }) })) }))
    renderApp('/')
    const figures = await screen.findByRole('region', { name: 'Figures of the period' })
    expect(within(figures).getByText('Rs 412,300')).toBeTruthy()
    expect(within(figures).getByText('64')).toBeTruthy()
    expect(within(figures).getByText(/up 12 percent on the period before/)).toBeTruthy() // 412,300 against 368,000
    expect(within(figures).getByText(/down 4 percent on the period before/)).toBeTruthy() // 64 orders against 67
    expect(within(figures).getAllByText('–').length).toBe(2)
  })

  it('shows the rates and why orders were lost when the API gives them', async () => {
    fakeApi(session(everything))
    renderApp('/')
    const figures = await screen.findByRole('region', { name: 'Figures of the period' })
    expect(within(figures).getByText('71%')).toBeTruthy()
    expect(within(figures).getByText('18%')).toBeTruthy()
    expect(within(figures).getByText(/5 customer cancelled, 3 refused at the door/)).toBeTruthy()
  })

  it('draws the bars as focusable items with a text of the day, and gives the same figures as a table', async () => {
    fakeApi(session(everything))
    const { user } = renderApp('/')
    const bars = await screen.findAllByRole('img', { name: /orders?$/ })
    expect(bars).toHaveLength(3)
    expect(bars[0]?.getAttribute('tabindex')).toBe('0')
    expect(bars[2]?.getAttribute('aria-label')?.replace(/\s/g, ' ')).toBe('12 Oct: Rs 32,000, 5 orders')
    await user.tab()
    const table = screen.getByRole('table', { name: 'Net sales by day' })
    expect(within(table).getAllByRole('row')).toHaveLength(4)
  })

  it('lists the top products and the searches with no results, and the first ten recent orders', async () => {
    fakeApi(session(everything))
    renderApp('/')
    expect(await screen.findByRole('link', { name: 'Lawn Suit' })).toBeTruthy()
    expect(screen.getByText('14 sold')).toBeTruthy()
    expect(await screen.findByText('kaftan')).toBeTruthy()
    const recent = screen.getByRole('heading', { name: 'Recent orders' }).closest('section') ?? document.body
    await within(recent).findByRole('link', { name: 'RB-10500' })
    expect(within(recent).getAllByRole('listitem')).toHaveLength(10)
    expect(within(recent).getAllByText('Sana')).toHaveLength(10) // the first name only
  })
})

describe('dashboard period (plan/07-admin/02-dashboard.md section 4)', () => {
  it('starts on the last 7 days of Pakistan days, and a change goes to the address and to the queries', async () => {
    /** @type {string[][]} */
    const asked = []
    fakeApi(session(everything, { 'GET /admin/dashboard/summary': ({ url }) => (asked.push([url.searchParams.get('from') ?? '', url.searchParams.get('to') ?? '']), json(200, summary())) }))
    const { user, router } = renderApp('/')
    await screen.findByRole('region', { name: 'Figures of the period' })
    const today = todayIn()
    expect(asked[0]).toEqual([addDays(today, -6), today])
    await user.selectOptions(screen.getByRole('combobox', { name: 'Period' }), '30d')
    await waitFor(() => expect(asked.at(-1)).toEqual([addDays(today, -29), today]))
    expect(router.state.location.search).toBe('?period=30d')
  })

  it('a reload restores the period from the address, and a custom range of more than 366 days is not taken', async () => {
    /** @type {string[][]} */
    const asked = []
    fakeApi(session(everything, { 'GET /admin/dashboard/summary': ({ url }) => (asked.push([url.searchParams.get('from') ?? '', url.searchParams.get('to') ?? '']), json(200, summary())) }))
    renderApp('/?from=2026-09-01&to=2026-09-30')
    await screen.findByRole('region', { name: 'Figures of the period' })
    expect(asked[0]).toEqual(['2026-09-01', '2026-09-30'])
    expect(screen.getByRole('combobox', { name: 'Period' })).toHaveProperty('value', 'custom')
    resetApp()
    asked.length = 0
    fakeApi(session(everything, { 'GET /admin/dashboard/summary': ({ url }) => (asked.push([url.searchParams.get('from') ?? '', url.searchParams.get('to') ?? '']), json(200, summary())) }))
    renderApp('/?from=2020-01-01&to=2026-09-30')
    await waitFor(() => expect(asked.length).toBeGreaterThan(0))
    expect(asked[0]?.[0]).toBe(addDays(todayIn(), -6)) // the default, not four years of days
  })
})

describe('dashboard states and permissions (plan/07-admin/02-dashboard.md sections 6 and 8)', () => {
  it('one panel that fails leaves the others working', async () => {
    fakeApi(session(everything, { 'GET /admin/dashboard/top-products': () => problem(500, 'internal_error') }))
    renderApp('/')
    expect(await screen.findByText('Top products could not be loaded')).toBeTruthy()
    expect(await screen.findByRole('region', { name: 'Figures of the period' })).toBeTruthy()
    expect(await screen.findByText('kaftan')).toBeTruthy()
    expect(screen.getByRole('link', { name: /12\s*to confirm/ })).toBeTruthy()
  })

  it('a role that cannot read orders sees the stock cards and no sales figures at all', async () => {
    fakeApi({
      'GET /admin/me': () => json(200, me({ permissions: stockOnly })),
      'GET /admin/dashboard/todo': () => json(200, { lowStock: { count: 5 }, soldOut: { count: 2 } }),
      'GET /admin/dashboard/zero-searches': () => json(200, { items: [] }),
    })
    renderApp('/')
    expect(await screen.findByRole('link', { name: /5\s*low stock/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /2\s*sold out/ })).toBeTruthy()
    expect(screen.queryByText('Net sales')).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Period' })).toBeNull()
    expect(screen.queryByText('Recent orders')).toBeNull()
  })
})
