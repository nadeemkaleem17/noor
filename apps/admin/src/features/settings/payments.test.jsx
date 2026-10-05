import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const storeValue = () => ({
  brand: { name: 'Rubaya' },
  contact: { socials: [] },
  priceDisplay: { showDecimals: false, rounding: 'none' },
  orderNumberPrefix: 'RB',
  locale: { default: 'en', supported: ['en'] },
  features: { wishlist: true, reviews: true, notifyMe: true, customSizing: true },
  policies: { returnsDays: 7 },
  seo: {},
  notifications: { staffEmails: [] },
  thresholds: { lowStock: 3, highValueCodMinor: 2_500_000 },
})
const adapters = (bank = false) => ['cod', 'bank_transfer', 'wallet', 'card', 'bnpl'].map((type) => ({ type, configured: type === 'cod' || (type === 'bank_transfer' && bank) }))
const codOnly = () => ({ methods: [{ type: 'cod', enabled: true, label: 'Cash on delivery', sortOrder: 0 }] })
const bankDetails = { accountTitle: 'Rubaya', bank: 'HBL', accountNumber: 'PK00HABB0000000000', instructions: 'Send a screenshot' }
const perms = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'settings:read', 'settings:write'])

/** A fake settings server that keeps what is saved. @param {{ permissions?: import('@noor/contract').Permission[]; value?: any; }} [o] */
function server({ permissions = perms, value = codOnly() } = {}) {
  const state = { payments: { value, version: 3 }, store: { value: storeValue(), version: 9 }, puts: /** @type {any[]} */ ([]), storePuts: /** @type {any[]} */ ([]) }
  fakeApi({
    'GET /admin/me': () => json(200, me({ permissions })),
    'GET /admin/settings/payments': () => json(200, { ...state.payments, images: {}, adapters: adapters(Boolean(state.payments.value.bankTransfer)) }),
    'PUT /admin/settings/payments': ({ body }) => {
      state.puts.push(body)
      state.payments = { value: body.value, version: body.version + 1 }
      return json(200, { ...state.payments, images: {}, adapters: adapters(Boolean(body.value.bankTransfer)) })
    },
    'GET /admin/settings/store': () => json(200, { ...state.store, images: {} }),
    'PUT /admin/settings/store': ({ body }) => {
      state.storePuts.push(body)
      state.store = { value: body.value, version: body.version + 1 }
      return json(200, { ...state.store, images: {} })
    },
  })
  return state
}
const card = (/** @type {string} */ id) => within(/** @type {HTMLElement} */ (document.getElementById(id)))
const bankFilled = () => ({ methods: [...codOnly().methods, { type: 'bank_transfer', enabled: false, label: 'Bank transfer', sortOrder: 1 }], bankTransfer: bankDetails })

describe('payments (plan/07-admin/10-shipping-payments.md section 3)', () => {
  it('says which methods customers can pay with now, and shows the others as not connected', async () => {
    server()
    renderApp('/settings/payments')
    expect((await screen.findByText(/Customers can pay with/)).textContent).toBe('Customers can pay with: Cash on delivery')
    expect(card('wallet').getByText('Not connected')).toBeTruthy()
    expect(card('card').getByText('Not connected')).toBeTruthy()
    expect(document.getElementById('bnpl')).toBeNull()
    expect(screen.queryByText(/key|secret|token/i, { selector: 'label' })).toBeNull()
  })

  it('will not switch off the only method that is on, and says why', async () => {
    server()
    renderApp('/settings/payments')
    await screen.findByText(/Customers can pay with/)
    const toggle = /** @type {HTMLElement} */ (await card('cod').findByRole('switch', { name: 'Accept cash on delivery' }))
    expect(toggle.hasAttribute('data-disabled') || toggle.getAttribute('aria-disabled') === 'true' || (/** @type {HTMLButtonElement} */ (toggle)).disabled).toBe(true)
    expect(card('cod').getByText(/only payment method that is on/)).toBeTruthy()
  })

  it('saves the cash on delivery wording and limit; the high-value threshold goes to the store document only when changed', async () => {
    const s = server()
    const { user } = renderApp('/settings/payments')
    await screen.findByText(/Customers can pay with/)
    const limit = await card('cod').findByLabelText('Order limit')
    await user.type(limit, '150000')
    await user.type(card('cod').getByLabelText('Description'), 'Pay the rider')
    await user.click(card('cod').getByRole('button', { name: 'Save cash on delivery' }))
    await waitFor(() => expect(s.puts).toHaveLength(1))
    expect(s.puts[0].version).toBe(3)
    expect(s.puts[0].value).toEqual({ methods: [{ type: 'cod', enabled: true, label: 'Cash on delivery', description: 'Pay the rider', sortOrder: 0 }], codLimitMinor: 15_000_000 })
    expect(s.storePuts).toHaveLength(0)

    const high = card('cod').getByLabelText(/^High-value order/)
    await user.clear(high)
    await user.type(high, '30000')
    await user.click(card('cod').getByRole('button', { name: 'Save cash on delivery' }))
    await waitFor(() => expect(s.storePuts).toHaveLength(1))
    expect(s.storePuts[0].version).toBe(9)
    expect(s.storePuts[0].value.thresholds).toEqual({ lowStock: 3, highValueCodMinor: 3_000_000 })
  })

  it('bank transfer needs every account detail before it can be turned on', async () => {
    const s = server()
    const { user } = renderApp('/settings/payments')
    await screen.findByText(/Customers can pay with/)
    await user.click(await card('bank_transfer').findByRole('switch', { name: 'Accept bank transfer' }))
    await user.click(card('bank_transfer').getByRole('button', { name: 'Save bank transfer' }))
    expect((await card('bank_transfer').findAllByText('Too short')).length).toBe(3)
    expect(s.puts).toHaveLength(0)

    await user.type(card('bank_transfer').getByLabelText(/^Account title/), 'Rubaya')
    await user.type(card('bank_transfer').getByLabelText(/^Bank$/), 'HBL')
    await user.type(card('bank_transfer').getByLabelText(/^Account number/), 'PK00HABB0000000000')
    await user.click(card('bank_transfer').getByRole('button', { name: 'Save bank transfer' }))
    await waitFor(() => expect(s.puts).toHaveLength(1))
    expect(s.puts[0].value.bankTransfer).toEqual({ accountTitle: 'Rubaya', bank: 'HBL', accountNumber: 'PK00HABB0000000000', instructions: '' })
    expect(s.puts[0].value.methods.find((/** @type {any} */ m) => m.type === 'bank_transfer')).toMatchObject({ enabled: true, label: 'Bank transfer' })
    expect(s.puts[0].value.methods.find((/** @type {any} */ m) => m.type === 'cod')).toMatchObject({ enabled: true })
    expect((await screen.findByText(/Customers can pay with/)).textContent).toBe('Customers can pay with: Cash on delivery, Bank transfer')
  })

  it('reorders the methods that are on, and saves the new order', async () => {
    const s = server({ value: { ...bankFilled(), methods: [{ type: 'cod', enabled: true, label: 'Cash on delivery', sortOrder: 0 }, { type: 'bank_transfer', enabled: true, label: 'Bank transfer', sortOrder: 1 }] } })
    const { user } = renderApp('/settings/payments')
    await screen.findByText(/Customers can pay with/)
    await user.click(await card('order').findByRole('button', { name: 'Move Bank transfer up' }))
    await waitFor(() => expect(s.puts).toHaveLength(1))
    expect(s.puts[0].value.methods.map((/** @type {any} */ m) => [m.type, m.sortOrder])).toEqual([['cod', 1], ['bank_transfer', 0]])
    expect((await screen.findByText(/Customers can pay with/)).textContent).toBe('Customers can pay with: Bank transfer, Cash on delivery')
  })

  it('is read-only without settings:write', async () => {
    server({ permissions: ['dashboard:read', 'settings:read'] })
    renderApp('/settings/payments')
    await screen.findByText(/Customers can pay with/)
    expect((/** @type {HTMLInputElement} */ (await card('cod').findByLabelText(/^Name at checkout/))).readOnly).toBe(true)
    expect(screen.queryByRole('button', { name: /^Save / })).toBeNull()
  })
})
