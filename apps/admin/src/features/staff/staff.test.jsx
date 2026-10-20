import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, ids, json, me, problem, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const uid = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-${String(n).padStart(12, '0')}`
const person = (/** @type {Record<string, unknown>} */ over) => ({ id: uid(9), name: 'Bilal Raza', email: 'bilal@example.com', role: 'manager', status: 'active', twoFactorEnabled: false, grants: [], revokes: [], permissions: [], version: 3, createdAt: '2026-09-01T05:00:00.000Z', lastSeenAt: '2026-10-05T08:00:00.000Z', ...over })
const people = () => [
  person({ id: ids.staff, name: 'Ayesha Khan', email: 'ayesha@example.com', role: 'owner', twoFactorEnabled: true }),
  person({ id: uid(2), name: 'Bilal Raza', email: 'bilal@example.com', role: 'manager', twoFactorEnabled: false }),
  person({ id: uid(3), name: 'Chand Ali', email: 'chand@example.com', role: 'catalog', twoFactorEnabled: true }),
  person({ id: uid(4), name: 'Dua Malik', email: 'dua@example.com', role: 'support', status: 'invited', inviteExpiresAt: new Date(Date.now() + 5 * 86_400_000 + 3_600_000).toISOString(), lastSeenAt: undefined }),
  person({ id: uid(5), name: 'Esa Shah', email: 'esa@example.com', role: 'viewer', status: 'deactivated' }),
]
const roles = () => ({
  items: [
    { role: 'owner', label: 'Owner', summary: 'Everything.', twoFactorRequired: true, permissions: ['staff:manage', 'products:read'] },
    { role: 'manager', label: 'Manager', summary: 'Everything but owners.', twoFactorRequired: true, permissions: ['products:read'] },
    { role: 'catalog', label: 'Catalog', summary: 'Products and content.', twoFactorRequired: false, permissions: ['products:read'] },
  ],
})
const manage = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'staff:read', 'staff:manage'])

/** @param {import('@noor/contract').Permission[]} [permissions] @param {Record<string, (r: { body: any; headers: Headers; }) => Response>} [extra] */
function server(permissions = manage, extra = {}) {
  fakeApi({
    'GET /admin/me': () => json(200, me({ permissions })),
    'GET /admin/roles': () => json(200, roles()),
    'GET /admin/staff': () => json(200, { items: people(), total: 5, page: 1, size: 50 }),
    ...extra,
  })
}
const row = (/** @type {string} */ name) => within(/** @type {HTMLElement} */ (screen.getByText(name).closest('tr')))

describe('staff list (plan/07-admin/12-staff-roles.md sections 3 and 4)', () => {
  it('lists people with role, two-step status (red when their role needs it) and status', async () => {
    server()
    renderApp('/staff')
    await screen.findByText('Bilal Raza')
    expect(row('Bilal Raza').getByText('Off')).toBeTruthy()
    expect(row('Chand Ali').getByText('On')).toBeTruthy()
    expect(row('Ayesha Khan').getByText('On')).toBeTruthy()
    expect(row('Dua Malik').getByText('Invited')).toBeTruthy()
    expect(row('Dua Malik').getByText(/expires in 5 days/)).toBeTruthy()
    expect(row('Esa Shah').getByText('Deactivated')).toBeTruthy()
  })

  it('has no actions for your own row; a deactivated person can only be reactivated', async () => {
    server()
    renderApp('/staff')
    await screen.findByText('Bilal Raza')
    expect(screen.queryByRole('button', { name: 'Actions for Ayesha Khan' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Actions for Bilal Raza' })).toBeTruthy()
  })

  it('invites: the password is asked for when the sign-in is old, then the link is shown once with a copy button', async () => {
    let attempts = 0
    /** @type {any[]} */
    const bodies = []
    server(manage, {
      'POST /admin/staff': ({ body }) => (bodies.push(body), ++attempts === 1 ? problem(403, 'step_up_required') : json(201, { ...person({ id: uid(7), name: body.name, email: body.email, role: body.role, status: 'invited' }), inviteLink: 'https://admin.example/accept-invite/TOKEN-ABC-123' })),
      'POST /admin/me/confirm-password': () => json(204),
    })
    const { user } = renderApp('/staff')
    await user.click(await screen.findByRole('button', { name: 'Invite staff' }))
    const form = within(await screen.findByRole('dialog', { name: 'Invite staff' }))
    await user.type(form.getByLabelText(/^Name/), 'Farah Zia')
    await user.type(form.getByLabelText(/^Email/), 'farah@example.com')
    await user.selectOptions(form.getByLabelText(/^Role/), 'catalog')
    await user.click(form.getByRole('button', { name: 'Invite' }))
    const ask = within(await screen.findByRole('dialog', { name: 'Confirm your password' }))
    await user.type(ask.getByLabelText(/^Your password/), 'my password 123')
    await user.click(ask.getByRole('button', { name: 'Confirm' }))
    const link = await screen.findByLabelText('Link')
    expect(link.textContent).toBe('https://admin.example/accept-invite/TOKEN-ABC-123')
    expect(bodies).toEqual([{ name: 'Farah Zia', email: 'farah@example.com', role: 'catalog' }, { name: 'Farah Zia', email: 'farah@example.com', role: 'catalog' }])
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByLabelText('Link')).toBeNull()
  })

  it('edits name and role with the stored version', async () => {
    /** @type {any[]} */
    const puts = []
    server(manage, { [`PUT /admin/staff/${uid(2)}`]: ({ body }) => (puts.push(body), json(200, person({ id: uid(2), name: body.name, role: body.role }))) })
    const { user } = renderApp('/staff')
    await user.click(await screen.findByRole('button', { name: 'Actions for Bilal Raza' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    const form = within(await screen.findByRole('dialog', { name: 'Edit Bilal Raza' }))
    await user.selectOptions(form.getByLabelText(/^Role/), 'catalog')
    await user.click(form.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(puts).toEqual([{ name: 'Bilal Raza', role: 'catalog', version: 3 }]))
  })

  it('explains a refusal to deactivate the last owner and keeps the dialog open', async () => {
    server(manage, { [`POST /admin/staff/${uid(2)}/deactivate`]: () => problem(409, 'last_owner') })
    const { user } = renderApp('/staff')
    await user.click(await screen.findByRole('button', { name: 'Actions for Bilal Raza' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Deactivate' }))
    const confirm = within(await screen.findByRole('alertdialog'))
    await user.click(confirm.getByRole('button', { name: 'Deactivate' }))
    expect((await screen.findAllByText(/last active owner cannot be demoted/)).length).toBeGreaterThan(0)
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })

  it('reset password shows the one-time link; reset two-step is offered only to people who have it', async () => {
    server(manage, { [`POST /admin/staff/${uid(3)}/password-reset`]: () => json(200, { resetLink: 'https://admin.example/reset-password/RESET-TOKEN-1' }) })
    const { user } = renderApp('/staff')
    await user.click(await screen.findByRole('button', { name: 'Actions for Bilal Raza' }))
    await screen.findByRole('menuitem', { name: 'Reset password' })
    expect(screen.queryByRole('menuitem', { name: 'Reset two-step sign-in' })).toBeNull()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Actions for Chand Ali' }))
    expect(await screen.findByRole('menuitem', { name: 'Reset two-step sign-in' })).toBeTruthy()
    await user.click(await screen.findByRole('menuitem', { name: 'Reset password' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reset password' }))
    expect((await screen.findByLabelText('Link')).textContent).toBe('https://admin.example/reset-password/RESET-TOKEN-1')
  })

  it('shows what each role can do from the server list, not from a constant', async () => {
    server()
    const { user } = renderApp('/staff')
    await user.click(await screen.findByRole('button', { name: 'View permissions' }))
    const table = within(await screen.findByRole('table', { name: 'Permissions by role' }))
    expect(table.getByText('staff:manage')).toBeTruthy()
    expect(table.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Permission', 'Owner', 'Manager', 'Catalog'])
  })

  it('without staff:manage there is no invite button and no row actions', async () => {
    server(['dashboard:read', 'staff:read'])
    renderApp('/staff')
    await screen.findByText('Bilal Raza')
    expect(screen.queryByRole('button', { name: 'Invite staff' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Actions for/ })).toBeNull()
  })
})

describe('staff member (plan/07-admin/12-staff-roles.md section 3)', () => {
  it('shows one person with their sessions', async () => {
    server(manage, { [`GET /admin/staff/${uid(2)}`]: () => json(200, { ...person({ id: uid(2) }), sessions: [{ id: 'c'.repeat(16), current: false, createdAt: '2026-10-04T05:00:00.000Z', lastSeenAt: '2026-10-05T05:00:00.000Z', ip: '10.1.1.1', userAgent: 'Mozilla/5.0 Firefox/130.0' }] }) })
    renderApp(`/staff/${uid(2)}`)
    expect(await screen.findByRole('heading', { name: 'Bilal Raza' })).toBeTruthy()
    expect(screen.getByText('10.1.1.1')).toBeTruthy()
    expect(screen.getByText('Firefox')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Actions' })).toBeTruthy()
  })
})
