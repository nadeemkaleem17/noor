import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { HistoryPanel } from '@/components/history-panel'
import { fakeApi, json, me, problem, renderApp, renderWithApp, resetApp } from '@/test/app'

afterEach(resetApp)

const uid = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-${String(n).padStart(12, '0')}`
const entry = (/** @type {number} */ n, /** @type {Record<string, unknown>} */ over = {}) => ({
  id: uid(100 + n),
  at: '2026-10-05T09:30:15.000Z',
  actorType: 'staff',
  actorId: uid(1),
  actorLabel: 'Ayesha Khan',
  actorRole: 'owner',
  action: 'product.updated',
  entityType: 'product',
  entityId: uid(50),
  entityLabel: 'Embroidered Lawn 3-Piece',
  summary: 'price 699000 → 749000',
  category: 'general',
  ip: '10.0.0.•••',
  ...over,
})
/** @param {HTMLElement} el */
const rowOf = (el) => within(/** @type {HTMLElement} */ (el.closest('tr')))
const perms = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'audit:read', 'staff:read'])

describe('audit log (plan/07-admin/13-audit-log.md)', () => {
  it('lists entries with a sentence, a link to the actor and to the entity, and the summary', async () => {
    fakeApi({ 'GET /admin/me': () => json(200, me({ permissions: perms })), 'GET /admin/audit': () => json(200, { items: [entry(1), entry(2, { actorType: 'system', actorId: undefined, actorLabel: 'sign-in', action: 'auth.login_failed', entityType: 'staff', entityId: undefined, entityLabel: 'x@example.com', summary: undefined, category: 'security' })] }) })
    renderApp('/audit')
    const row = rowOf(await screen.findByText('updated product'))
    expect(row.getByRole('link', { name: 'Ayesha Khan' }).getAttribute('href')).toBe(`/staff/${uid(1)}`)
    expect(row.getByRole('link', { name: 'Embroidered Lawn 3-Piece' }).getAttribute('href')).toBe(`/products/${uid(50)}`)
    expect(row.getByText('price 699000 → 749000')).toBeTruthy()
    const failed = rowOf(screen.getByText(/failed sign-in/))
    expect(failed.getByText('security')).toBeTruthy()
    expect(failed.queryByRole('link', { name: 'Ayesha Khan' })).toBeNull()
  })

  it('restores the filters from the address and sends them; the Security button changes the address', async () => {
    /** @type {URL[]} */
    const seen = []
    fakeApi({ 'GET /admin/me': () => json(200, me({ permissions: perms })), 'GET /admin/audit': ({ url }) => (seen.push(url), json(200, { items: [entry(1)] })) })
    const { user, router } = renderApp(`/audit?entityType=product&entityId=${uid(50)}`)
    await screen.findByText('updated product')
    expect(seen[0]?.searchParams.get('entityType')).toBe('product')
    expect(seen[0]?.searchParams.get('entityId')).toBe(uid(50))
    await user.click(screen.getByRole('button', { name: 'Security' }))
    await waitFor(() => expect(seen.at(-1)?.searchParams.get('category')).toBe('security'))
    expect(router.state.location.search).toContain('category=security')
  })

  it('loads more with the cursor the server gave', async () => {
    /** @type {(string | null)[]} */
    const cursors = []
    fakeApi({
      'GET /admin/me': () => json(200, me({ permissions: perms })),
      'GET /admin/audit': ({ url }) => {
        cursors.push(url.searchParams.get('cursor'))
        return url.searchParams.get('cursor') ? json(200, { items: [entry(2, { action: 'product.published' })], total: 2 }) : json(200, { items: [entry(1)], nextCursor: 'CURSOR-1', total: 2 })
      },
    })
    const { user } = renderApp('/audit')
    await screen.findByText('updated product')
    await user.click(screen.getByRole('button', { name: /load more|show more/i }))
    expect(await screen.findByText('published product')).toBeTruthy()
    expect(cursors).toEqual([null, 'CURSOR-1'])
  })

  it('opens an entry from the address with only the changed fields: money as rupees, secrets hidden', async () => {
    const detail = entry(1, {
      userAgent: 'Mozilla/5.0 Chrome/130',
      requestId: 'req-abc',
      diff: { price: [699000, 749000], status: ['draft', 'active'], tags: [['a', 'b'], ['a', 'c']], totpSecret: '[redacted]' },
    })
    fakeApi({ 'GET /admin/me': () => json(200, me({ permissions: perms })), 'GET /admin/audit': () => json(200, { items: [entry(1)] }), [`GET /admin/audit/${detail.id}`]: () => json(200, detail) })
    renderApp(`/audit?entry=${detail.id}`)
    const drawer = within(await screen.findByRole('dialog'))
    const changes = within(await drawer.findByRole('table', { name: 'Changed fields, before and after' }))
    expect(changes.getByTitle('699000 paisa').textContent).toMatch(/6,990/)
    expect(changes.getByTitle('749000 paisa').textContent).toMatch(/7,490/)
    expect(changes.getByText('draft')).toBeTruthy()
    expect(changes.getByText('active')).toBeTruthy()
    expect(rowOf(changes.getByText('totpSecret')).getByText('•••')).toBeTruthy()
    expect(drawer.getByText('req-abc')).toBeTruthy()
    expect(drawer.getByRole('link', { name: 'All activity by this person' }).getAttribute('href')).toBe(`/audit?actorId=${uid(1)}`)
  })

  it('shows the no-access state when the server refuses', async () => {
    fakeApi({ 'GET /admin/me': () => json(200, me({ permissions: ['dashboard:read'] })), 'GET /admin/audit': () => problem(403, 'forbidden') })
    renderApp('/audit')
    expect(await screen.findByText("You don't have access to this page")).toBeTruthy()
  })
})

describe('History panel (section 4)', () => {
  it('asks for the 10 newest entries of that thing only when opened, and links to the filtered log', async () => {
    /** @type {URL[]} */
    const seen = []
    const { user } = renderWithApp(<HistoryPanel entityType="product" entityId={uid(50)} />, { permissions: perms })
    fakeApi({ 'GET /admin/me': () => json(200, me({ permissions: perms })), 'GET /admin/audit': ({ url }) => (seen.push(url), json(200, { items: [entry(1)] })) })
    await user.click(await screen.findByText('History'))
    expect(await screen.findByText('updated product', { exact: false })).toBeTruthy()
    expect(seen).toHaveLength(1)
    expect(seen[0]?.searchParams.get('limit')).toBe('10')
    expect(seen[0]?.searchParams.get('entityType')).toBe('product')
    expect(screen.getByRole('link', { name: 'View all' }).getAttribute('href')).toBe(`/audit?entityType=product&entityId=${uid(50)}`)
  })

  it('is not there without audit:read', async () => {
    renderWithApp(<HistoryPanel entityType="product" entityId={uid(50)} />, { permissions: ['dashboard:read'] })
    await new Promise((r) => setTimeout(r, 300))
    expect(screen.queryByText('History')).toBeNull()
  })
})
