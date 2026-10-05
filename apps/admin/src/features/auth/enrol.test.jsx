import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const pending = { 'GET /admin/me': () => json(200, me({ twoFactorEnabled: false })) }
const begin = { 'POST /admin/me/2fa/begin': () => json(200, { otpauthUri: 'otpauth://totp/Rubaya%20Admin:a%40b.c?secret=JBSWY3DPEHPK3PXP&issuer=Rubaya%20Admin', secret: 'JBSWY3DPEHPK3PXP' }) }

describe('two-step set-up (plan/07-admin/12-staff-roles.md section 5)', () => {
  it('shows the key and QR, takes the first code, then keeps Done locked until the recovery codes are acknowledged', async () => {
    const codes = ['AAAAA-11111', 'BBBBB-22222']
    fakeApi({ ...pending, ...begin, 'POST /admin/me/2fa/enable': ({ body }) => (body.code === '123456' ? json(200, { recoveryCodes: codes }) : problem(422, 'invalid_code')) })
    const { router, user } = renderApp('/enrol-2fa')
    await user.click(await screen.findByRole('button', { name: 'Start set-up' }))
    expect((await screen.findByLabelText('Setup key')).textContent).toBe('JBSW Y3DP EHPK 3PXP')
    expect(screen.getByRole('img', { name: /QR code/ })).toBeTruthy()

    await user.type(screen.getByLabelText(/6-digit code/), '000000')
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    expect((await screen.findByRole('alert')).textContent).toBe('That code is not right. Check the app and try again.')

    await user.clear(screen.getByLabelText(/6-digit code/))
    await user.type(screen.getByLabelText(/6-digit code/), '123456')
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    expect((await screen.findAllByRole('listitem')).map((li) => li.textContent)).toEqual(codes)

    const done = screen.getByRole('button', { name: 'Done' })
    expect(/** @type {HTMLButtonElement} */ (done).disabled).toBe(true)
    await user.click(screen.getByRole('checkbox', { name: 'I have saved these codes' }))
    expect(/** @type {HTMLButtonElement} */ (done).disabled).toBe(false)
    fakeApi({ 'GET /admin/me': () => json(200, me()) })
    await user.click(done)
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/')
  })

  it('asks for the password when the server wants a fresh confirmation', async () => {
    let attempts = 0
    fakeApi({
      ...pending,
      'POST /admin/me/2fa/begin': () => (attempts++ === 0 ? problem(403, 'step_up_required') : json(200, { otpauthUri: 'otpauth://totp/x?secret=JBSWY3DPEHPK3PXP', secret: 'JBSWY3DPEHPK3PXP' })),
      'POST /admin/me/confirm-password': ({ body }) => (body.password === 'right password here' ? json(204) : problem(401, 'invalid_credentials')),
    })
    const { user } = renderApp('/enrol-2fa')
    await user.click(await screen.findByRole('button', { name: 'Start set-up' }))
    await user.type(await screen.findByLabelText(/Confirm your password/), 'right password here')
    await user.click(screen.getByRole('button', { name: 'Confirm and continue' }))
    expect(await screen.findByLabelText('Setup key')).toBeTruthy()
  })

  it('has only this screen and sign-out while set-up is required', async () => {
    fakeApi(pending)
    renderApp('/enrol-2fa')
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
  })
})
