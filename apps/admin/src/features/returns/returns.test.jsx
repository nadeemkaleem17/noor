import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const id = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-0000000007${String(n).padStart(2, '0')}`
const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })
const request = (/** @type {object} */ over = {}) => ({
  id: id(1), number: 'RR-0001', kind: 'return', status: 'requested', reason: 'wrong_size', note: 'Too tight', requestedAt: '2026-10-20T08:00:00.000Z',
  orderId: id(50), orderNumber: 'RB-10458', customerName: 'Sana Malik', customerPhone: '+923001234567',
  lines: [{ title: 'Lawn 3-Piece', variantLabel: 'M', quantity: 1, lineTotal: money(699000) }], orderTotal: money(724000), next: ['approved', 'declined'], ...over,
})
const counts = { requested: 1, approved: 0, declined: 0, received: 0, completed: 0 }
const all = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'orders:read', 'orders:return'])
/** @param {{ items?: object[]; permissions?: import('@noor/contract').Permission[]; puts?: any[]; asked?: string[] }} [o] */
function server({ items = [request()], permissions = all, puts = [], asked = [] } = {}) {
  fakeApi({
    'GET /admin/me': () => json(200, me({ permissions })),
    'GET /admin/returns': ({ url }) => (asked.push(url.search), json(200, { items, total: items.length, page: 1, size: 100, counts })),
    [`POST /admin/returns/${id(1)}/update`]: ({ body }) => (puts.push(body), json(200, request({ status: body.status, next: [] }))),
  })
  return { puts, asked }
}

describe('returns queue (plan/06-storefront/14-site-blueprint.md RT-04)', () => {
  it('lists what customers asked, with the order, the pieces, the reason and the counts of each tab', async () => {
    const s = server()
    renderApp('/returns')
    const card = within((await screen.findByText(/RR-0001 · Return/)).closest('li') ?? document.body)
    expect(card.getByRole('link', { name: 'RB-10458' }).getAttribute('href')).toBe(`/orders/${id(50)}`)
    expect(card.getByText(/Lawn 3-Piece \(M\)/)).toBeTruthy()
    expect(card.getByText(/Does not fit/)).toBeTruthy()
    expect(card.getByText('Waiting')).toBeTruthy()
    expect(within(screen.getByRole('navigation', { name: 'Request status' })).getByRole('button', { name: /Waitings*1/ }).getAttribute('aria-pressed')).toBe('true')
    expect(s.asked[0]).toContain('status=requested')
  })

  it('approves with a pickup day and sends only what was filled in', async () => {
    const s = server()
    const { user } = renderApp('/returns')
    await user.click(await screen.findByRole('button', { name: 'Approve' }))
    const dialog = await screen.findByRole('dialog', { name: /Approve: RR-0001/ })
    await user.type(within(dialog).getByLabelText(/^Pickup day/), '2026-11-02')
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(s.puts).toHaveLength(1))
    expect(s.puts[0]).toEqual({ status: 'approved', pickupOn: '2026-11-02' })
  })

  it('will not decline without the words the customer reads', async () => {
    const s = server()
    const { user } = renderApp('/returns')
    await user.click(await screen.findByRole('button', { name: 'Decline' }))
    const dialog = await screen.findByRole('dialog', { name: /Decline: RR-0001/ })
    const send = within(dialog).getByRole('button', { name: 'Decline' })
    expect(send.hasAttribute('disabled')).toBe(true)
    await user.type(within(dialog).getByLabelText(/^Why/), 'Worn and washed')
    await user.click(send)
    await waitFor(() => expect(s.puts).toEqual([{ status: 'declined', decisionNote: 'Worn and washed' }]))
  })

  it('writes down a refund only when a return is marked done', async () => {
    const s = server({ items: [request({ status: 'received', next: ['completed'] })] })
    const { user } = renderApp('/returns')
    await user.click(await screen.findByRole('button', { name: 'Mark done' }))
    const dialog = await screen.findByRole('dialog', { name: /Mark done: RR-0001/ })
    await user.type(within(dialog).getByLabelText(/^Refund/), '6990')
    await user.click(within(dialog).getByRole('button', { name: 'Mark done' }))
    await waitFor(() => expect(s.puts).toHaveLength(1))
    expect(s.puts[0]).toEqual({ status: 'completed', refund: 699000 })
  })

  it('shows no buttons to people who may only read, and says so when nothing waits', async () => {
    server({ permissions: ['dashboard:read', 'orders:read'] })
    renderApp('/returns')
    await screen.findByText(/RR-0001 · Return/)
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    resetApp()
    server({ items: [] })
    renderApp('/returns')
    expect(await screen.findByText('No request is waiting for you.')).toBeTruthy()
  })
})
