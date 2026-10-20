import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { permissionModules, permissions } from '@noor/contract'
import { fakeApi, ids, json, me, renderApp, resetApp } from '@/test/app'
import { permissionLabels } from '@/lib/permission-labels'

afterEach(resetApp)

const uid = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-${String(n).padStart(12, '0')}`
const supportRole = ['dashboard:read', 'products:read', 'catalog:read', 'orders:read', 'orders:note', 'customers:read', 'customers:write', 'promos:read', 'reviews:read', 'reviews:moderate', 'deliveries:read']
const roles = () => ({
  items: [
    { role: 'owner', label: 'Owner', summary: 'Everything.', twoFactorRequired: true, permissions: [...permissions] },
    { role: 'support', label: 'Support', summary: 'Reads orders and customers.', twoFactorRequired: false, permissions: supportRole },
  ],
})
const person = (/** @type {Record<string, unknown>} */ over = {}) => ({
  id: uid(2), name: 'Dua Malik', email: 'dua@example.com', role: 'support', status: 'active', twoFactorEnabled: true, grants: [], revokes: [], permissions: supportRole, version: 4, createdAt: '2026-09-01T05:00:00.000Z', sessions: [], ...over,
})
const manage = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'staff:read', 'staff:manage', 'promos:write', 'promos:read', 'customers:read'])

/** @param {{ staff?: object; permissions?: import('@noor/contract').Permission[]; puts?: any[] }} [o] */
function server({ staff = person(), permissions: perms = manage, puts = [] } = {}) {
  fakeApi({
    'GET /admin/me': () => json(200, me({ permissions: perms })),
    'GET /admin/roles': () => json(200, roles()),
    [`GET /admin/staff/${/** @type {{ id: string }} */ (staff).id}`]: () => json(200, staff),
    [`PUT /admin/staff/${/** @type {{ id: string }} */ (staff).id}/permissions`]: ({ body }) => (puts.push(body), json(200, { ...staff, ...body, permissions: [] })),
  })
  return puts
}
const box = (/** @type {RegExp | string} */ name) => screen.getByRole('checkbox', { name })

describe('every permission has words and a module', () => {
  it('has a label for each permission, and each module lists real ones', () => {
    expect(Object.keys(permissionLabels).sort()).toEqual([...permissions].sort())
    expect(permissionModules.flatMap((m) => m.permissions).sort()).toEqual([...permissions].sort())
  })
})

describe('module access of a person (plan/17-owner-requests-2026-10.md item 11)', () => {
  it('shows what the role gives and what is added or taken away, module by module', async () => {
    server({ staff: person({ grants: ['promos:write'], revokes: ['customers:write'], permissions: [] }) })
    renderApp(`/staff/${uid(2)}`)
    const card = within(await screen.findByRole('region', { name: 'Module access' }))
    expect(card.getByText('Customers')).toBeTruthy()
    await waitFor(() => expect(box(/See customers/).getAttribute('aria-checked')).toBe('true')) // the roles arrive a moment after the person
    expect(box(/Change customers and add notes/).getAttribute('aria-checked')).toBe('false')
    expect(card.getByText(/Add and change promo codes/).parentElement?.textContent).toContain('added for this person')
    expect(card.getByText(/Change customers and add notes/).parentElement?.textContent).toContain('taken away')
    expect(card.getAllByText('Full access').length).toBeGreaterThan(0) // the dashboard module: its one permission
  })

  it('adds and takes away, and sends only the two lists with the version it read', async () => {
    const puts = server()
    const { user } = renderApp(`/staff/${uid(2)}`)
    await screen.findByRole('region', { name: 'Module access' })
    expect(screen.getByRole('button', { name: 'Save access' }).hasAttribute('disabled')).toBe(true) // nothing changed yet
    await user.click(box(/Add and change promo codes/)) // not in the role: a grant
    await user.click(box(/Change customers and add notes/)) // in the role: a revoke
    await user.click(screen.getByRole('button', { name: 'Save access' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toEqual({ grants: ['promos:write'], revokes: ['customers:write'], version: 4 })
  })

  it('takes away a whole module and puts it back to the role', async () => {
    const puts = server()
    const { user } = renderApp(`/staff/${uid(2)}`)
    const card = within(await screen.findByRole('region', { name: 'Module access' }))
    const reviews = within(/** @type {HTMLElement} */ (card.getByText('Reviews').closest('fieldset')))
    await user.click(reviews.getByRole('button', { name: /Take away all of reviews/ }))
    expect(reviews.getByText('No access')).toBeTruthy()
    await user.click(reviews.getByRole('button', { name: 'Back to the role' }))
    expect(reviews.getByText('Full access')).toBeTruthy()
    await user.click(reviews.getByRole('button', { name: /Take away all of reviews/ }))
    await user.click(screen.getByRole('button', { name: 'Save access' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0].grants).toEqual([])
    expect([...puts[0].revokes].sort()).toEqual(['reviews:moderate', 'reviews:read'])
  })

  it('does not offer to give what the person making the change does not hold', async () => {
    server() // this manager has promos:write but not reviews:moderate's neighbours such as products:write
    renderApp(`/staff/${uid(2)}`)
    await screen.findByRole('region', { name: 'Module access' })
    expect(box(/Add and change products/).getAttribute('aria-disabled')).toBe('true')
    expect(box(/Add and change promo codes/).getAttribute('aria-disabled')).not.toBe('true')
  })

  it('shows an owner as having everything, unchangeable, and gives a reader no buttons', async () => {
    server({ staff: person({ role: 'owner', permissions: [...permissions] }) })
    renderApp(`/staff/${uid(2)}`)
    expect(await screen.findByText(/An owner may do everything/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save access' })).toBeNull()
  })

  it('shows nobody their own access to change', async () => {
    server({ staff: person({ id: ids.staff }) })
    renderApp(`/staff/${ids.staff}`)
    expect(await screen.findByText(/Nobody changes their own access/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save access' })).toBeNull()
  })
})
