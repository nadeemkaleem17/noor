import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { defaultEmails } from '@noor/contract'
import { fakeApi, json, me, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const storeValue = (/** @type {object} */ emails = defaultEmails) => ({
  brand: { name: 'Rubaya' },
  contact: { socials: [] },
  priceDisplay: { showDecimals: false, rounding: 'none' },
  orderNumberPrefix: 'RB',
  locale: { default: 'en', supported: ['en'] },
  features: { wishlist: true, reviews: true, notifyMe: true, customSizing: true, visitTracking: true },
  policies: {},
  seo: {},
  notifications: { staffEmails: [] },
  emails,
  thresholds: { lowStock: 3, highValueCodMinor: 2_500_000 },
})
const perms = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'settings:read', 'settings:write', 'settings:manage'])
const logRow = (/** @type {number} */ n, /** @type {object} */ over = {}) => ({ id: `0194f1b2-7c3a-7000-8000-0000000006${String(n).padStart(2, '0')}`, template: 'order.placed', recipient: 'sana@example.com', status: 'sent', orderNumber: 'RB-10001', body: 'Hi', createdAt: '2026-10-20T10:00:00.000Z', ...over })

/** @param {{ configured?: boolean, emails?: object, more?: Record<string, (r: { body: any; headers: Headers; url: URL }) => Response> }} [o] */
function server({ configured = true, emails = defaultEmails, more = {} } = {}) {
  const state = { puts: /** @type {any[]} */ ([]), previews: /** @type {any[]} */ ([]), tests: /** @type {any[]} */ ([]) }
  fakeApi({
    'GET /admin/me': () => json(200, me({ permissions: perms })),
    'GET /admin/settings/store': () => json(200, { value: storeValue(emails), version: 5, images: {} }),
    'PUT /admin/settings/store': ({ body }) => (state.puts.push(body), json(200, { value: body.value, version: 6, images: {} })),
    'GET /admin/emails/status': () => json(200, { configured, from: 'Rubaya <no-reply@rubaya.pk>' }),
    'GET /admin/emails/log': () => json(200, { items: [logRow(1), logRow(2, { status: 'failed', error: 'connection refused', recipient: 'ali@example.com' }), logRow(3, { status: 'skipped', template: 'test.placed' })], total: 3, page: 1, size: 50 }),
    'POST /admin/emails/preview': ({ body }) => (state.previews.push(body), json(200, { subject: 'Hi Ayesha', body: 'Order RB-10001 for Rs 7,240', sample: true })),
    'POST /admin/emails/test': ({ body }) => (state.tests.push(body), json(200, { status: 'sent' })),
    ...more,
  })
  return state
}

describe('the emails screen (plan/17-owner-requests-2026-10.md item 13)', () => {
  it('lists the six events with their switches, says where mail comes from, and shows the log', async () => {
    server()
    renderApp('/settings/emails')
    const events = await screen.findAllByRole('heading', { level: 3 })
    expect(events.map((h) => h.textContent)).toEqual(['Order received', 'Order confirmed', 'Order dispatched', 'Order delivered', 'Order cancelled', 'Order returned'])
    expect(await screen.findByText(/no-reply@rubaya.pk/)).toBeTruthy()
    const log = await screen.findByRole('table', { name: 'Email log' })
    expect(within(log).getByText('Sent')).toBeTruthy()
    expect(within(log).getByText('connection refused')).toBeTruthy()
    expect(within(log).getByText('Not sent (no mail server)')).toBeTruthy()
    expect(screen.queryByText(/No mail server is set up on this server/)).toBeNull()
  })

  it('warns that nothing is being emailed while no mail server is set up', async () => {
    server({ configured: false })
    renderApp('/settings/emails')
    expect(await screen.findByText(/No mail server is set up on this server/)).toBeTruthy()
  })

  it('switches an event off and saves only the emails of the store, with the version it read', async () => {
    const s = server()
    const { user } = renderApp('/settings/emails')
    await user.click(await screen.findByRole('switch', { name: 'Send "Order delivered"' }))
    await user.click(screen.getByRole('button', { name: 'Save emails' }))
    await waitFor(() => expect(s.puts).toHaveLength(1))
    expect(s.puts[0].version).toBe(5)
    expect(s.puts[0].value.emails.enabled).toBe(true)
    expect(s.puts[0].value.emails.events.delivered).toEqual({ enabled: false })
    expect(s.puts[0].value.emails.events.placed).toEqual({ enabled: true }) // wording left alone: nothing sent for it
    expect(s.puts[0].value.brand).toEqual({ name: 'Rubaya' }) // the rest of the store is untouched
  })

  it('writes an own subject and message with words from the order, previews them unsaved, and saves them with the sender', async () => {
    const s = server()
    const { user } = renderApp('/settings/emails')
    const row = (await screen.findByRole('heading', { name: 'Order dispatched' })).closest('li')
    const within_ = within(/** @type {HTMLElement} */ (row))
    await user.click(within_.getByRole('button', { name: 'Edit the wording' }))
    await user.click(within_.getByLabelText('Subject'))
    await user.paste('On its way, {{name}}')
    await user.click(within_.getByLabelText('Message'))
    await user.paste('Order {{orderNo}} left today. ')
    await user.click(within_.getByRole('button', { name: '{{tracking}}' }))
    expect((/** @type {HTMLTextAreaElement} */ (within_.getByLabelText('Message'))).value).toBe('Order {{orderNo}} left today. {{tracking}}')
    await user.click(within_.getByRole('button', { name: 'Preview' }))
    expect(await within_.findByRole('region', { name: 'Preview' })).toBeTruthy()
    expect(within_.getByText('Hi Ayesha')).toBeTruthy()
    expect(within_.getByText(/made-up values/)).toBeTruthy()
    expect(s.previews[0]).toEqual({ event: 'dispatched', subject: 'On its way, {{name}}', body: 'Order {{orderNo}} left today. {{tracking}}' }) // what is typed, not what is saved
    await user.type(screen.getByLabelText('Sender name'), 'Rubaya Care')
    await user.type(screen.getByLabelText('Replies go to'), 'care@rubaya.pk')
    await user.click(screen.getByRole('button', { name: 'Save emails' }))
    await waitFor(() => expect(s.puts).toHaveLength(1))
    expect(s.puts[0].value.emails).toMatchObject({ senderName: 'Rubaya Care', replyTo: 'care@rubaya.pk', events: { dispatched: { enabled: true, subject: 'On its way, {{name}}', body: 'Order {{orderNo}} left today. {{tracking}}' } } })
  })

  it('refuses a word the shop does not know and says where, without calling the server', async () => {
    const s = server()
    const { user } = renderApp('/settings/emails')
    const row = (await screen.findByRole('heading', { name: 'Order received' })).closest('li')
    const within_ = within(/** @type {HTMLElement} */ (row))
    await user.click(within_.getByRole('button', { name: 'Edit the wording' }))
    await user.click(within_.getByLabelText('Message'))
    await user.paste('Hello {{password}}')
    await user.click(screen.getByRole('button', { name: 'Save emails' }))
    await waitFor(() => expect(within_.getByLabelText('Message').getAttribute('aria-invalid')).toBe('true'))
    expect(s.puts).toHaveLength(0)
  })

  it('sends a test to the address typed, only once there is one', async () => {
    const s = server()
    const { user } = renderApp('/settings/emails')
    const row = (await screen.findByRole('heading', { name: 'Order confirmed' })).closest('li')
    const within_ = within(/** @type {HTMLElement} */ (row))
    await user.click(within_.getByRole('button', { name: 'Edit the wording' }))
    const send = within_.getByRole('button', { name: 'Send the test' })
    expect(send.hasAttribute('disabled')).toBe(true)
    await user.type(within_.getByLabelText('Send a test to'), 'me@example.com')
    await user.click(send)
    await waitFor(() => expect(s.tests).toHaveLength(1))
    expect(s.tests[0]).toEqual({ event: 'confirmed', to: 'me@example.com', subject: '', body: '' })
    expect((await screen.findAllByText('A test message was sent to me@example.com')).length).toBeGreaterThan(0)
  })

  it('offers going back to the shop\'s own wording once an event has its own', async () => {
    const own = { ...defaultEmails, events: { ...defaultEmails.events, placed: { enabled: true, subject: 'Thanks', body: 'We got it.' } } }
    const s = server({ emails: own })
    const { user } = renderApp('/settings/emails')
    const row = (await screen.findByRole('heading', { name: 'Order received' })).closest('li')
    const within_ = within(/** @type {HTMLElement} */ (row))
    expect(within_.getByText('Own wording')).toBeTruthy()
    await user.click(within_.getByRole('button', { name: 'Edit the wording' }))
    await user.click(within_.getByRole('button', { name: "Use the shop's wording" }))
    await user.click(screen.getByRole('button', { name: 'Save emails' }))
    await waitFor(() => expect(s.puts).toHaveLength(1))
    expect(s.puts[0].value.emails.events.placed).toEqual({ enabled: true })
  })
})
