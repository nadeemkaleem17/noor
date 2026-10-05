import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const sessions = () => ({
  items: [
    { id: 'a'.repeat(16), current: true, createdAt: '2026-10-05T04:00:00.000Z', lastSeenAt: '2026-10-05T09:00:00.000Z', ip: '127.0.0.1', userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36' },
    { id: 'b'.repeat(16), current: false, createdAt: '2026-10-03T04:00:00.000Z', lastSeenAt: '2026-10-04T09:00:00.000Z', ip: '10.0.0.7', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari/604.1' },
  ],
})
const card = (/** @type {string} */ id) => within(/** @type {HTMLElement} */ (document.getElementById(id)))
const base = (/** @type {Partial<import('@noor/contract').Me>} */ over = {}) => ({ 'GET /admin/me': () => json(200, me(over)), 'GET /admin/me/sessions': () => json(200, sessions()) })

describe('my account (plan/07-admin/12-staff-roles.md section 6)', () => {
  it('saves the name; email and role are read-only', async () => {
    /** @type {any[]} */
    const puts = []
    fakeApi({ ...base(), 'PUT /admin/me': ({ body }) => (puts.push(body), json(200, me({ name: body.name }))) })
    const { user } = renderApp('/account')
    await screen.findByRole('heading', { name: 'My account' })
    expect((/** @type {HTMLInputElement} */ (card('profile').getByLabelText('Email'))).readOnly).toBe(true)
    const name = card('profile').getByLabelText(/^Name/)
    await user.clear(name)
    await user.type(name, 'Ayesha K. Khan')
    await user.click(card('profile').getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(puts).toEqual([{ name: 'Ayesha K. Khan' }]))
  })

  it('changes the password: the two new ones must match, the server judges strength', async () => {
    /** @type {any[]} */
    const posts = []
    fakeApi({ ...base(), 'POST /admin/me/password': ({ body }) => (posts.push(body), body.newPassword === 'weakweakweak' ? problem(422, 'password_too_weak', { reason: 'common' }) : json(204)) })
    const { user } = renderApp('/account')
    await screen.findByRole('heading', { name: 'My account' })
    const fill = async (/** @type {string} */ a, /** @type {string} */ b, /** @type {string} */ c) => {
      for (const [label, v] of /** @type {const} */ ([[/^Current password/, a], [/^New password/, b], [/^Repeat the new/, c]])) {
        const box = card('password').getByLabelText(label)
        await user.clear(box)
        await user.type(box, v)
      }
      await user.click(card('password').getByRole('button', { name: 'Change password' }))
    }
    await fill('old password 1', 'a long new phrase 1', 'a long new phrase 2')
    expect(await card('password').findByText('The two passwords do not match')).toBeTruthy()
    expect(posts).toHaveLength(0)
    await fill('old password 1', 'weakweakweak', 'weakweakweak')
    expect((await card('password').findByRole('alert')).textContent).toMatch(/not strong enough/)
    await fill('old password 1', 'a long new phrase 1', 'a long new phrase 1')
    await waitFor(() => expect(posts.at(-1)).toEqual({ currentPassword: 'old password 1', newPassword: 'a long new phrase 1' }))
  })

  it('lists sessions, marks this device and signs out one or all of the others', async () => {
    /** @type {string[]} */
    const calls = []
    fakeApi({
      ...base(),
      [`DELETE /admin/me/sessions/${'b'.repeat(16)}`]: () => (calls.push('one'), json(204)),
      'POST /admin/me/sessions/revoke-others': () => (calls.push('others'), json(204)),
    })
    const { user } = renderApp('/account')
    await screen.findByText('Chrome on Windows')
    expect(card('sessions').getByText('This device')).toBeTruthy()
    expect(card('sessions').getAllByRole('button', { name: /^Sign out Safari on iOS/ })).toHaveLength(1)
    expect(card('sessions').queryByRole('button', { name: /^Sign out Chrome/ })).toBeNull()
    await user.click(card('sessions').getByRole('button', { name: /^Sign out Safari on iOS/ }))
    await waitFor(() => expect(calls).toEqual(['one']))
    await user.click(card('sessions').getByRole('button', { name: 'Sign out all other sessions' }))
    await waitFor(() => expect(calls).toEqual(['one', 'others']))
  })

  it('shows recovery codes once; Done waits for the tick; a role that needs two-step cannot turn it off', async () => {
    fakeApi({ ...base(), 'POST /admin/me/2fa/recovery-codes': () => json(200, { recoveryCodes: ['AAAAA-11111', 'BBBBB-22222'] }) })
    const { user } = renderApp('/account')
    await screen.findByRole('heading', { name: 'My account' })
    expect(card('two-factor').queryByRole('button', { name: 'Turn off' })).toBeNull()
    await user.click(card('two-factor').getByRole('button', { name: 'New recovery codes' }))
    const dialog = within(await screen.findByRole('dialog'))
    expect((await dialog.findAllByRole('listitem')).map((li) => li.textContent)).toEqual(['AAAAA-11111', 'BBBBB-22222'])
    expect((/** @type {HTMLButtonElement} */ (dialog.getByRole('button', { name: 'Done' }))).disabled).toBe(true)
    await user.click(dialog.getByRole('checkbox'))
    await user.click(dialog.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByText('AAAAA-11111')).toBeNull())
  })

  it('turning two-step off asks for the password again when the sign-in is old, then repeats the call', async () => {
    let attempts = 0
    /** @type {string[]} */
    const confirmed = []
    fakeApi({
      ...base({ twoFactorRequired: false }),
      'DELETE /admin/me/2fa': () => (++attempts === 1 ? problem(403, 'step_up_required') : json(204)),
      'POST /admin/me/confirm-password': ({ body }) => (confirmed.push(body.password), body.password === 'right password 1' ? json(204) : problem(401, 'invalid_credentials')),
    })
    const { user } = renderApp('/account')
    await screen.findByRole('heading', { name: 'My account' })
    await user.click(await card('two-factor').findByRole('button', { name: 'Turn off' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Turn off' }))
    const ask = within(await screen.findByRole('dialog', { name: 'Confirm your password' }))
    await user.type(ask.getByLabelText(/^Your password/), 'wrong password 1')
    await user.click(ask.getByRole('button', { name: 'Confirm' }))
    expect((await ask.findByRole('alert')).textContent).toMatch(/not right/)
    await user.clear(ask.getByLabelText(/^Your password/))
    await user.type(ask.getByLabelText(/^Your password/), 'right password 1')
    await user.click(ask.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(attempts).toBe(2))
    expect(confirmed).toEqual(['wrong password 1', 'right password 1'])
  })

  it('cancelling the password dialog changes nothing and shows no error', async () => {
    let attempts = 0
    fakeApi({ ...base({ twoFactorRequired: false }), 'DELETE /admin/me/2fa': () => (++attempts, problem(403, 'step_up_required')) })
    const { user } = renderApp('/account')
    await screen.findByRole('heading', { name: 'My account' })
    await user.click(await card('two-factor').findByRole('button', { name: 'Turn off' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Turn off' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Confirm your password' })).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirm your password' })).toBeNull())
    expect(attempts).toBe(1)
    expect(screen.queryByText(/Something went wrong/)).toBeNull()
  })
})
