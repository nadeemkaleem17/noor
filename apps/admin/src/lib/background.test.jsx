// The warning about the server's background worker (apps/admin/src/lib/background.js, components/background-banner.jsx).
import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, renderApp, resetApp } from '@/test/app'
import { backgroundNotice, describeWork } from './background'

afterEach(resetApp)

/** @param {Partial<import('@noor/contract').BackgroundStatus>} over @returns {import('@noor/contract').BackgroundStatus} */
const status = (over) => ({ state: 'ok', workers: 1, waiting: 0, overdue: 0, oldestOverdueSeconds: 0, dead: 0, waitingTypes: [], ...over })

describe('what the banner says', () => {
  it('says nothing while all is well, while nobody is needed, and before the first answer', () => {
    expect(backgroundNotice(undefined)).toBeUndefined()
    expect(backgroundNotice(status({}))).toBeUndefined()
    expect(backgroundNotice(status({ state: 'idle', workers: 0 }))).toBeUndefined()
  })

  it('names what is waiting and how long, when nobody is working', () => {
    const n = backgroundNotice(status({ state: 'down', workers: 0, waiting: 6, overdue: 6, oldestOverdueSeconds: 300, waitingTypes: ['media.process', 'search.reindex_product', 'notify.order'] }))
    expect(n?.tone).toBe('danger')
    expect(n?.text).toContain('pictures, search updates and emails and messages are waiting')
    expect(n?.text).toContain('6 tasks')
    expect(n?.text).toContain('5 minutes')
    expect(n?.text).toContain('pnpm dev')
  })

  it('is only a note when the worker is running but something has waited over a minute', () => {
    const n = backgroundNotice(status({ state: 'stalled', oldestOverdueSeconds: 75, waitingTypes: ['media.process'] }))
    expect(n).toMatchObject({ tone: 'warning' })
    expect(n?.text).toContain('75 seconds')
  })

  it('puts the kinds of work into one sentence', () => {
    expect(describeWork(['media.process'])).toBe('pictures')
    expect(describeWork(['media.process', 'media.cleanup'])).toBe('pictures')
    expect(describeWork(['x'])).toBe('other background tasks')
    expect(describeWork([])).toBe('background tasks')
  })
})

describe('in the shell', () => {
  it('shows an alert when the worker is down', async () => {
    fakeApi({
      'GET /admin/me': () => json(200, me()),
      'GET /admin/background': () => json(200, status({ state: 'down', workers: 0, waiting: 2, overdue: 2, oldestOverdueSeconds: 600, waitingTypes: ['media.process'] })),
    })
    renderApp('/')
    const text = await screen.findByText(/The background worker is not running/)
    expect(text.closest('[role="alert"]'), 'it is an alert, so a screen reader hears it').not.toBeNull()
    expect(text.textContent).toContain('pictures')
  })

  it('shows no alert when the worker is running', async () => {
    fakeApi({ 'GET /admin/me': () => json(200, me()) })
    renderApp('/')
    await screen.findByRole('heading', { name: 'Dashboard' })
    expect(screen.queryByText(/background worker is not running/)).toBeNull()
  })
})
