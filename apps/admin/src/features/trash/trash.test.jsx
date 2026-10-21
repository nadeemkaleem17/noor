import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const id = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-0000000004${String(n).padStart(2, '0')}`
const soon = (/** @type {number} */ days) => new Date(Date.now() + days * 86_400_000).toISOString()
const item = (/** @type {number} */ n, /** @type {object} */ over = {}) => ({ id: id(n), kind: 'promo', label: `CODE${n}`, deletedAt: new Date(Date.now() - 3_600_000).toISOString(), deletedBy: 'Hina Owner', expiresAt: soon(29), ...over })
const perms = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'catalog:write'])

/** @param {{ items?: object[]; log?: string[] }} [o] */
function server({ items = [item(1), item(2, { kind: 'product', label: 'Lawn Suit (lawn-suit)' })], log = [] } = {}) {
  fakeApi({
    'GET /admin/me': () => json(200, me({ permissions: perms })),
    'GET /admin/trash': () => json(200, { items }),
    [`POST /admin/trash/${id(1)}/restore`]: () => (log.push('restore 1'), json(200, { kind: 'promo', id: id(9), label: 'CODE1' })),
    [`POST /admin/trash/${id(2)}/restore`]: () => (log.push('restore 2'), problem(400, 'validation_failed', { issues: [{ path: 'handle', code: 'invalid_format' }] })),
    [`DELETE /admin/trash/${id(1)}`]: () => (log.push('purge 1'), new Response(null, { status: 204 })),
  })
  return log
}

describe('trash (plan/17-owner-requests-2026-10.md item 6)', () => {
  it('lists what was deleted with its kind, who deleted it and how long it is kept', async () => {
    server()
    renderApp('/trash')
    const first = (await screen.findByText('CODE1')).closest('li') ?? document.body
    expect(within(first).getByText(/Promo code · deleted .* by Hina Owner · kept 29 more days/)).toBeTruthy()
    expect(screen.getByText('Lawn Suit (lawn-suit)')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Put back' })).toHaveLength(2)
  })

  it('puts one back and says so; one that cannot be put back says why and stays', async () => {
    const log = server()
    const { user } = renderApp('/trash')
    const rows = [(await screen.findByText('CODE1')).closest('li'), (await screen.findByText('Lawn Suit (lawn-suit)')).closest('li')]
    await user.click(within(rows[0] ?? document.body).getByRole('button', { name: 'Put back' }))
    await waitFor(() => expect(log).toContain('restore 1'))
    expect((await screen.findAllByText('CODE1 is back')).length).toBeGreaterThan(0)
    await user.click(within(rows[1] ?? document.body).getByRole('button', { name: 'Put back' }))
    expect(await screen.findByText(/It could not be put back:/)).toBeTruthy()
    expect(screen.getByText('Lawn Suit (lawn-suit)')).toBeTruthy() // still listed
  })

  it('deletes one for good only after a question', async () => {
    const log = server()
    const { user } = renderApp('/trash')
    const rows = [(await screen.findByText('CODE1')).closest('li'), (await screen.findByText('Lawn Suit (lawn-suit)')).closest('li')]
    await user.click(within(rows[0] ?? document.body).getByRole('button', { name: 'Delete now' }))
    expect(log).toEqual([])
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete for good' }))
    await waitFor(() => expect(log).toEqual(['purge 1']))
  })

  it('says when the trash is empty', async () => {
    server({ items: [] })
    renderApp('/trash')
    expect(await screen.findByText('The trash is empty')).toBeTruthy()
  })
})
