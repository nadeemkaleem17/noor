import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { permissions } from '@noor/contract'
import { fakeApi, json, me, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const uid = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-0000000005${String(n).padStart(2, '0')}`
const supportRole = ['dashboard:read', 'products:read', 'catalog:read', 'orders:read', 'orders:note', 'customers:read', 'customers:write', 'promos:read', 'reviews:read', 'reviews:moderate', 'deliveries:read']
const roles = () => ({
  items: [
    { role: 'owner', label: 'Owner', summary: 'Everything.', twoFactorRequired: true, permissions: [...permissions] },
    { role: 'support', label: 'Support', summary: 'Reads orders and customers.', twoFactorRequired: false, permissions: supportRole },
    { role: 'viewer', label: 'Viewer', summary: 'Looks only.', twoFactorRequired: false, permissions: ['dashboard:read', 'orders:read'] },
  ],
})
const profile = (/** @type {object} */ over = {}) => ({
  id: uid(1), name: 'Delivery coordinator', summary: 'Runs deliveries', baseRole: 'support', grants: ['deliveries:assign'], revokes: ['reviews:moderate'], permissions: [], members: 2, version: 3, updatedAt: '2026-10-20T05:00:00.000Z', ...over,
})
const person = (/** @type {object} */ over = {}) => ({
  id: uid(2), name: 'Dua Malik', email: 'dua@example.com', role: 'viewer', status: 'active', twoFactorEnabled: true, grants: [], revokes: [], permissions: ['dashboard:read'], version: 4, createdAt: '2026-09-01T05:00:00.000Z', sessions: [], ...over,
})
const manage = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'staff:read', 'staff:manage', 'deliveries:assign', 'customers:read', 'customers:write', 'orders:read'])

/** @param {{ items?: object[]; permissions?: import('@noor/contract').Permission[]; sent?: any[]; staff?: object }} [o] */
function server({ items = [profile()], permissions: perms = manage, sent = [], staff = person() } = {}) {
  fakeApi({
    'GET /admin/me': () => json(200, me({ permissions: perms })),
    'GET /admin/roles': () => json(200, roles()),
    'GET /admin/access-profiles': () => json(200, { items }),
    'POST /admin/access-profiles': ({ body }) => (sent.push({ create: body }), json(201, profile({ ...body, id: uid(9), members: 0, version: 1 }))),
    [`PUT /admin/access-profiles/${uid(1)}`]: ({ body }) => (sent.push({ update: body }), json(200, profile(body))),
    [`DELETE /admin/access-profiles/${uid(1)}`]: () => (sent.push({ delete: true }), new Response(null, { status: 204 })),
    [`GET /admin/staff/${/** @type {{ id: string }} */ (staff).id}`]: () => json(200, staff),
    [`PUT /admin/staff/${/** @type {{ id: string }} */ (staff).id}/profile`]: ({ body }) => (sent.push({ apply: body }), json(200, { ...staff, profileId: body.profileId ?? undefined })),
  })
  return sent
}

describe('roles (plan/17-owner-requests-2026-10.md item 11, custom named roles)', () => {
  it('lists the roles staff made with how many people have each, and the built-in ones', async () => {
    server()
    renderApp('/staff/roles')
    const mine = within(await screen.findByRole('region', { name: 'Your roles' }))
    expect(await mine.findByText('Delivery coordinator')).toBeTruthy()
    expect(mine.getByText('Like Support')).toBeTruthy()
    expect(mine.getByText('2 people')).toBeTruthy()
    expect(mine.getByText(/1 added to Support/)).toBeTruthy()
    const builtIn = within(screen.getByRole('region', { name: 'Built-in roles' }))
    expect(await builtIn.findByText('Support')).toBeTruthy()
    expect(builtIn.getByText(/two-step sign-in required/)).toBeTruthy()
  })

  it('makes a role from a built-in one and sends only the name, the base role and what differs from it', async () => {
    const sent = server({ items: [] })
    const { user } = renderApp('/staff/roles')
    expect(await screen.findByText('No role of your own yet')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'New role' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'New role' }))
    expect(dialog.getByRole('button', { name: 'Make the role' }).hasAttribute('disabled')).toBe(true) // no name yet
    await user.type(dialog.getByLabelText(/^Name/), 'Night shift')
    // support has orders:note; deliveries:assign is an addition, customers:write a removal
    await user.click(await dialog.findByRole('checkbox', { name: /Give orders to riders/ }))
    await user.click(dialog.getByRole('checkbox', { name: /Change customers and add notes/ }))
    await user.click(dialog.getByRole('button', { name: 'Make the role' }))
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].create).toMatchObject({ name: 'Night shift', baseRole: 'support' })
    expect(sent[0].create.grants).toEqual(['deliveries:assign'])
    expect(sent[0].create.revokes).toEqual(['customers:write'])
  })

  it('changes a role with the version it read, and says that everyone who has it follows', async () => {
    const sent = server()
    const { user } = renderApp('/staff/roles')
    await user.click(await screen.findByRole('button', { name: 'Change' }))
    const dialog = within(await screen.findByRole('dialog', { name: /Change "Delivery coordinator"/ }))
    expect(dialog.getByText(/2 people have this role: saving changes their access at once/)).toBeTruthy()
    const name = dialog.getByLabelText(/^Name/)
    await user.clear(name)
    await user.type(name, 'Dispatcher')
    await user.click(dialog.getByRole('button', { name: 'Save role' }))
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].update).toMatchObject({ name: 'Dispatcher', baseRole: 'support', grants: ['deliveries:assign'], revokes: ['reviews:moderate'], version: 3 })
  })

  it('deletes a role after saying what happens to its people', async () => {
    const sent = server()
    const { user } = renderApp('/staff/roles')
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    const ask = await screen.findByRole('alertdialog')
    expect(within(ask).getByText(/keep the access they have now/)).toBeTruthy()
    await user.click(within(ask).getByRole('button', { name: 'Delete the role' }))
    await waitFor(() => expect(sent).toEqual([{ delete: true }]))
  })

  it('gives a person a role from their page and lets go of it', async () => {
    const sent = server()
    const { user } = renderApp(`/staff/${uid(2)}`)
    const card = within(await screen.findByRole('region', { name: 'Role' }))
    await waitFor(() => expect(card.getByRole('option', { name: 'Delivery coordinator' })).toBeTruthy())
    await user.selectOptions(card.getByRole('combobox', { name: 'Role' }), 'Delivery coordinator')
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].apply).toEqual({ profileId: uid(1), version: 4 })
  })

  it('shows no role picker when the shop has made no role of its own, and no buttons to people who may only read', async () => {
    server({ items: [] })
    renderApp(`/staff/${uid(2)}`)
    await screen.findByRole('region', { name: 'Module access' })
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Role' })).toBeNull()) // gone once the shop's roles are known to be none
    resetApp()
  })

  it('shows no buttons to people who may only read the roles', async () => {
    server({ permissions: ['dashboard:read', 'staff:read'] })
    renderApp('/staff/roles')
    await screen.findByText('Delivery coordinator')
    expect(screen.queryByRole('button', { name: 'New role' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull()
  })
})
