import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const storeValue = () => ({
  brand: { name: 'Rubaya', tagline: 'Pakistani fashion' },
  contact: { whatsapp: '923001234567', phone: '+92 300 1234567', email: 'hello@rubaya.pk', address: 'Lahore', hours: '10am to 8pm', socials: [{ platform: 'instagram', url: 'https://instagram.com/rubaya' }] },
  priceDisplay: { showDecimals: false, rounding: 'none' },
  orderNumberPrefix: 'RB',
  locale: { default: 'en', supported: ['en'] },
  features: { wishlist: true, reviews: true, notifyMe: true, customSizing: true, visitTracking: true },
  policies: { returnsDays: 7, returns: 'Return within 7 days.' },
  seo: { homeDescription: 'Fashion from Lahore.' },
  notifications: { staffEmails: ['orders@rubaya.pk'] },
  thresholds: { lowStock: 3, highValueCodMinor: 2_500_000 },
})
const checkoutValue = () => ({ extraFields: [], marketingConsent: { enabled: true, label: 'Send me offers' } })
/** @param {any} value @param {number} [version] */
const doc = (value, version = 4) => ({ value, version, images: {} })
const perms = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'settings:read', 'settings:write', 'content:write'])

/** A fake settings server that keeps what is saved, like the real one. @param {import('@noor/contract').Permission[]} [permissions] */
function server(permissions = perms) {
  const state = { store: doc(storeValue()), checkout: doc(checkoutValue(), 1), puts: /** @type {any[]} */ ([]), checkoutPuts: /** @type {any[]} */ ([]) }
  fakeApi({
    'GET /admin/me': () => json(200, me({ permissions })),
    'GET /admin/settings/store': () => json(200, state.store),
    'PUT /admin/settings/store': ({ body }) => {
      state.puts.push(body)
      state.store = doc(body.value, body.version + 1)
      return json(200, state.store)
    },
    'GET /admin/settings/checkout': () => json(200, state.checkout),
    'PUT /admin/settings/checkout': ({ body }) => {
      state.checkoutPuts.push(body)
      state.checkout = doc(body.value, body.version + 1)
      return json(200, state.checkout)
    },
    'GET /admin/settings/translation-status': () => json(200, { ui: { total: 200, translated: 150 }, products: { total: 24, translated: 6 } }),
  })
  return state
}
/** The card with this id; call it after the page has rendered. @param {string} id */
const card = (id) => within(/** @type {HTMLElement} */ (document.getElementById(id)))

describe('store settings (plan/07-admin/11-settings.md section 2)', () => {
  it('saves one card with the stored version, leaving the other keys as they are', async () => {
    const s = server()
    const { user } = renderApp('/settings/store')
    const name = await screen.findByLabelText(/^Store name/)
    await user.clear(name)
    await user.type(name, 'Rubaya Lahore')
    await user.click(card('brand').getByRole('button', { name: 'Save brand' }))
    await waitFor(() => expect(s.puts).toHaveLength(1))
    expect(s.puts[0].version).toBe(4)
    expect(s.puts[0].value.brand).toEqual({ name: 'Rubaya Lahore', tagline: 'Pakistani fashion' })
    expect(s.puts[0].value.contact).toEqual(storeValue().contact)
    expect(s.puts[0].value.thresholds).toEqual({ lowStock: 3, highValueCodMinor: 2_500_000 })
  })

  it('does not save a card that was not changed, and does not take another card\'s unsaved edits along', async () => {
    const s = server()
    const { user } = renderApp('/settings/store')
    await user.type(await screen.findByLabelText(/^Store name/), '!')
    await user.type(screen.getByLabelText('Phone'), ' ext 1')
    expect(/** @type {HTMLButtonElement} */ (card('prices').getByRole('button', { name: 'Save prices' })).disabled).toBe(true)
    await user.click(card('brand').getByRole('button', { name: 'Save brand' }))
    await waitFor(() => expect(s.puts).toHaveLength(1))
    expect(s.puts[0].value.contact.phone).toBe('+92 300 1234567') // the Contact card is still unsaved
    await user.click(card('contact').getByRole('button', { name: 'Save contact' }))
    await waitFor(() => expect(s.puts).toHaveLength(2))
    expect(s.puts[1].version).toBe(5) // the second save read the first one's result
    expect(s.puts[1].value.brand.name).toBe('Rubaya!')
    expect(s.puts[1].value.contact.phone).toBe('+92 300 1234567 ext 1')
  })

  it('stores the WhatsApp number as digits, whatever way it was typed', async () => {
    const s = server()
    const { user } = renderApp('/settings/store')
    const box = await screen.findByLabelText('WhatsApp number')
    await user.clear(box)
    await user.type(box, '0321 7654321')
    await user.tab()
    await user.click(card('contact').getByRole('button', { name: 'Save contact' }))
    await waitFor(() => expect(s.puts).toHaveLength(1))
    expect(s.puts[0].value.contact.whatsapp).toBe('923217654321')
  })

  it('refuses an http map link and a bad order prefix, naming the field', async () => {
    const s = server()
    const { user } = renderApp('/settings/store')
    const map = await screen.findByLabelText('Map link')
    await user.type(map, 'http://maps.example/x')
    await user.click(card('contact').getByRole('button', { name: 'Save contact' }))
    expect(await card('contact').findByText('Enter a valid link')).toBeTruthy()
    const prefix = screen.getByLabelText('Order number prefix')
    await user.clear(prefix)
    await user.type(prefix, 'r')
    await user.click(card('prices').getByRole('button', { name: 'Save prices' }))
    expect(await card('prices').findByText('Enter a valid code')).toBeTruthy()
    expect(s.puts).toHaveLength(0)
  })

  it('makes the prefix capital letters as it is typed', async () => {
    server()
    const { user } = renderApp('/settings/store')
    const prefix = await screen.findByLabelText('Order number prefix')
    await user.clear(prefix)
    await user.type(prefix, 'ab')
    expect(/** @type {HTMLInputElement} */ (prefix).value).toBe('AB')
  })

  it('shows how much of Urdu exists once it is switched on, and limits the default to supported languages', async () => {
    const s = server()
    const { user } = renderApp('/settings/store')
    await screen.findByLabelText('Default language')
    expect(within(screen.getByLabelText('Default language')).getAllByRole('option').map((o) => o.textContent)).toEqual(['English'])
    await user.click(card('languages').getByRole('checkbox', { name: 'Urdu' }))
    expect(await card('languages').findByText(/75% of the shop's text and 25% of active products/)).toBeTruthy()
    expect(within(screen.getByLabelText('Default language')).getAllByRole('option').map((o) => o.textContent)).toEqual(['English', 'Urdu'])
    await user.click(card('languages').getByRole('button', { name: 'Save languages' }))
    await waitFor(() => expect(s.puts[0]?.value.locale).toEqual({ default: 'en', supported: ['en', 'ur'] }))
  })

  it('saves feature switches', async () => {
    const s = server()
    const { user } = renderApp('/settings/store')
    await user.click(await screen.findByRole('switch', { name: 'Reviews' }))
    await user.click(card('features').getByRole('button', { name: 'Save features' }))
    await waitFor(() => expect(s.puts[0]?.value.features).toEqual({ wishlist: true, reviews: false, notifyMe: true, customSizing: true, visitTracking: true }))
  })

  it('splits the notification emails and refuses one that is not an email', async () => {
    const s = server()
    const { user } = renderApp('/settings/store')
    const box = await screen.findByLabelText('Order notification emails')
    await user.clear(box)
    await user.type(box, 'a@rubaya.pk, b@rubaya.pk')
    await user.click(card('notifications').getByRole('button', { name: 'Save notifications' }))
    await waitFor(() => expect(s.puts[0]?.value.notifications.staffEmails).toEqual(['a@rubaya.pk', 'b@rubaya.pk']))
    await user.type(box, ', nope')
    await user.click(card('notifications').getByRole('button', { name: 'Save notifications' }))
    expect(await card('notifications').findByText('This is not in the right format')).toBeTruthy()
  })

  it('keeps the checkout fields in their own document, up to three', async () => {
    const s = server()
    const { user } = renderApp('/settings/store')
    await screen.findByLabelText(/^Store name/)
    await user.click(await card('checkout').findByRole('button', { name: 'Add a checkout field' }))
    await user.type(card('checkout').getByLabelText(/^Label/), 'Gift message')
    await user.selectOptions(card('checkout').getByLabelText(/^Type/), 'textarea')
    await user.click(card('checkout').getByRole('button', { name: 'Save checkout' }))
    await waitFor(() => expect(s.checkoutPuts).toHaveLength(1))
    expect(s.checkoutPuts[0].version).toBe(1)
    expect(s.checkoutPuts[0].value.extraFields).toEqual([{ key: 'giftMessage', label: 'Gift message', type: 'textarea', required: false }])
    expect(s.puts).toHaveLength(0)
  })

  it('refuses an extra checkout field that reuses a fixed key', async () => {
    const s = server()
    const { user } = renderApp('/settings/store')
    await screen.findByLabelText(/^Store name/)
    await user.click(await card('checkout').findByRole('button', { name: 'Add a checkout field' }))
    await user.type(card('checkout').getByLabelText(/^Label/), 'City')
    await user.click(card('checkout').getByRole('button', { name: 'Save checkout' }))
    await new Promise((r) => setTimeout(r, 300))
    expect(s.checkoutPuts).toHaveLength(0)
  })

  it('is read-only without settings:write', async () => {
    server(['dashboard:read', 'settings:read'])
    renderApp('/settings/store')
    expect(/** @type {HTMLInputElement} */ (await screen.findByLabelText(/^Store name/)).readOnly).toBe(true)
    expect(screen.queryByRole('button', { name: /^Save / })).toBeNull()
  })
})
