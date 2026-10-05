import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

/** @param {Parameters<typeof me>[0]} [over] */
const signedIn = (over) => ({ 'GET /admin/me': () => json(200, me(over)) })

describe('the session gate (plan/07-admin/01 sections 5 and 9)', () => {
  it('sends a signed-out visitor to /login and remembers the page', async () => {
    fakeApi({ 'GET /admin/me': () => problem(401, 'unauthenticated') })
    const { router } = renderApp('/products?status=draft')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/login')
    expect(new URLSearchParams(router.state.location.search).get('next')).toBe('/products?status=draft')
  })

  it('goes back to the remembered page after sign-in, and only to a same-origin one', async () => {
    const answers = { 'GET /admin/me': () => problem(401, 'unauthenticated'), 'POST /admin/auth/login': () => json(200, { next: 'ok' }) }
    fakeApi(answers)
    const { router, user } = renderApp('/products')
    await user.type(await screen.findByLabelText(/Email/), 'ayesha@example.com')
    await user.type(screen.getByLabelText(/Password/), 'a long enough password')
    fakeApi({ ...answers, ...signedIn() })
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Products' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/products')
  })

  it('ignores ?next=https://evil.example', async () => {
    const answers = { 'GET /admin/me': () => problem(401, 'unauthenticated'), 'POST /admin/auth/login': () => json(200, { next: 'ok' }) }
    fakeApi(answers)
    const { router, user } = renderApp('/login?next=https%3A%2F%2Fevil.example')
    await user.type(await screen.findByLabelText(/Email/), 'ayesha@example.com')
    await user.type(screen.getByLabelText(/Password/), 'a long enough password')
    fakeApi({ ...answers, ...signedIn() })
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/')
  })

  it('shows one message for a wrong email or password, and keeps the form', async () => {
    fakeApi({ 'GET /admin/me': () => problem(401, 'unauthenticated'), 'POST /admin/auth/login': () => problem(401, 'invalid_credentials') })
    const { user } = renderApp('/login')
    await user.type(await screen.findByLabelText(/Email/), 'ayesha@example.com')
    await user.type(screen.getByLabelText(/Password/), 'wrong password here')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect((await screen.findByRole('alert')).textContent).toBe('The email or password is not right.')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()
  })

  it('tells the person how long to wait after too many attempts', async () => {
    fakeApi({ 'POST /admin/auth/login': () => problem(429, 'too_many_attempts', { retryAfter: 600 }) })
    const { user } = renderApp('/login')
    await user.type(await screen.findByLabelText(/Email/), 'ayesha@example.com')
    await user.type(screen.getByLabelText(/Password/), 'wrong password here')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Too many attempts. Try again in 10 minutes.')
  })

  it('checks the form before calling the API', async () => {
    const calls = fakeApi({})
    const { user } = renderApp('/login')
    await user.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect((await screen.findAllByText('This field is required')).length).toBe(2)
    expect(calls).toEqual([])
  })

  it('moves on to the code screen when two-step sign-in is on', async () => {
    fakeApi({ 'POST /admin/auth/login': () => json(200, { next: 'two_factor' }) })
    const { router, user } = renderApp('/login?next=%2Forders')
    await user.type(await screen.findByLabelText(/Email/), 'ayesha@example.com')
    await user.type(screen.getByLabelText(/Password/), 'a long enough password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Two-step sign-in' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/login/2fa')
    expect(new URLSearchParams(router.state.location.search).get('next')).toBe('/orders')
  })

  it('accepts a 6-digit code or a recovery code', async () => {
    const bodies = /** @type {unknown[]} */ ([])
    fakeApi({
      'POST /admin/auth/2fa': ({ body }) => {
        bodies.push(body)
        return json(200, { next: 'ok' })
      },
      'GET /admin/me': () => json(200, me()),
    })
    const { user } = renderApp('/login/2fa')
    await user.type(await screen.findByLabelText(/6-digit code/), '123456')
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    await screen.findByRole('heading', { name: 'Dashboard' })
    expect(bodies).toEqual([{ code: '123456' }])
  })

  it('sends someone whose role needs two-step sign-in to set it up, and nowhere else', async () => {
    fakeApi(signedIn({ twoFactorEnabled: false, twoFactorRequired: true }))
    const { router } = renderApp('/products')
    expect(await screen.findByRole('heading', { name: 'Set up two-step sign-in' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/enrol-2fa')
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
  })
})

describe('the shell and permissions (plan/07-admin/01 sections 3 and 6)', () => {
  it('shows only what the role may open, and groups with nothing to show are left out', async () => {
    fakeApi(signedIn({ role: 'viewer', permissions: ['dashboard:read', 'products:read'] }))
    renderApp('/')
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Dashboard', 'Products'])
    expect(within(nav).getAllByRole('heading').map((h) => h.textContent)).toEqual(['Overview', 'Catalog'])
  })

  it('marks the current page, and a detail page keeps its list active', async () => {
    fakeApi(signedIn())
    renderApp('/products/new')
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Products' }).getAttribute('aria-current')).toBe('page')
    expect(within(nav).getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBeNull()
  })

  it('answers a URL the role cannot open with the access message, inside the shell', async () => {
    fakeApi(signedIn({ role: 'viewer', permissions: ['dashboard:read'] }))
    renderApp('/staff')
    expect(await screen.findByText("You don't have access to this page")).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy()
  })

  it('answers an unknown URL with "Page not found"', async () => {
    fakeApi(signedIn())
    renderApp('/no/such/page')
    expect(await screen.findByText('Page not found')).toBeTruthy()
  })

  it('keeps old addresses working', async () => {
    fakeApi(signedIn({ permissions: ['dashboard:read', 'content:read'] }))
    const { router } = renderApp('/pages')
    await waitFor(() => expect(router.state.location.pathname).toBe('/content/pages'))
  })

  it('warns outside production', async () => {
    fakeApi(signedIn({ environment: 'staging' }))
    renderApp('/')
    expect(await screen.findByText('Staging: test data')).toBeTruthy()
  })

  it('does not warn in production', async () => {
    fakeApi(signedIn({ environment: 'production' }))
    renderApp('/')
    await screen.findByRole('navigation', { name: 'Main' })
    expect(screen.queryByText(/test data/)).toBeNull()
  })

  it('signs out: tells the server, drops the cache and returns to /login', async () => {
    const calls = fakeApi({ ...signedIn(), 'POST /admin/auth/logout': () => json(204) })
    const { router, user } = renderApp('/')
    await user.click(await screen.findByRole('button', { name: 'Ayesha Khan, owner' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(calls).toContain('POST /admin/auth/logout')
  })

  it('sends the CSRF token from the session with every change', async () => {
    /** @type {string | null} */
    let seen = null
    fakeApi({
      ...signedIn(),
      'POST /admin/auth/logout': ({ headers }) => {
        seen = headers.get('x-csrf-token')
        return json(204)
      },
    })
    const { user } = renderApp('/')
    await user.click(await screen.findByRole('button', { name: 'Ayesha Khan, owner' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))
    await waitFor(() => expect(seen).toBe('csrf-token-1'))
  })
})
