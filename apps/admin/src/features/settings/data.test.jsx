import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const info = (/** @type {object} */ over = {}) => ({ environment: 'local', version: '0.1.0', queue: { pending: 2, dead: 0 }, ...over })

describe('data (plan/07-admin/11-settings.md section 4)', () => {
  it('shows the last backup, the queue and the version', async () => {
    fakeApi({ 'GET /admin/me': () => json(200, me({ permissions: ['dashboard:read', 'settings:manage'] })), 'GET /admin/system': () => json(200, info({ lastBackupAt: '2026-10-05T01:00:00.000Z', queue: { pending: 2, dead: 1, oldestPendingAgeSec: 130 } })) })
    renderApp('/settings/data')
    expect((await screen.findByText(/Last successful backup/)).textContent).toMatch(/2026/)
    expect(screen.getByText('Local')).toBeTruthy()
    expect(screen.getByText('0.1.0')).toBeTruthy()
    expect(screen.getByText('Background jobs that failed').nextElementSibling?.textContent).toBe('1')
    expect(screen.getByText('3 min')).toBeTruthy()
    expect(screen.getByText(/Some background jobs failed/)).toBeTruthy()
  })

  it('says so when no backup has been reported, and has no reset or delete control', async () => {
    fakeApi({ 'GET /admin/me': () => json(200, me({ permissions: ['dashboard:read', 'settings:manage'] })), 'GET /admin/system': () => json(200, info()) })
    renderApp('/settings/data')
    expect(await screen.findByText('No backup has been reported yet.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /reset|delete|erase|clear/i })).toBeNull()
  })

  it('offers an error state with a retry when the server cannot answer', async () => {
    fakeApi({ 'GET /admin/me': () => json(200, me({ permissions: ['dashboard:read', 'settings:manage'] })), 'GET /admin/system': () => problem(500, 'internal_error') })
    renderApp('/settings/data')
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy()
  })
})
