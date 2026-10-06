// How money is collected (plan/12-integrations.md section 3, ADR-0017). Nothing outside this module imports a provider; the registry is the only door.
// Launch: `cod` and `manual` (staff-entered) and `bank_transfer` (instructions). `fake` is for tests and local development of the gateway flow:
// it signs its webhooks like a real one would, with HMAC-SHA256 over the raw body.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { DomainError } from '../../platform/errors.js'

/**
 * @typedef {import('@noor/contract').EnumValue<'paymentState'>} PaymentState
 * @typedef {{ kind: 'none' } | { kind: 'instructions', text: string } | { kind: 'redirect', url: string, expiresAt: Date, providerRef?: string }} Session
 * @typedef {object} PaymentProvider
 * @property {string} id
 * @property {boolean} configured an adapter with missing configuration is never called
 * @property {(input: { paymentId: string, orderNumber: string, amount: { amount: number, currency: 'PKR' }, bank?: { accountTitle: string, bank: string, accountNumber: string, instructions?: string }, returnUrl?: string }) => Promise<Session>} createSession
 * @property {(rawBody: Buffer, headers: Record<string, string | string[] | undefined>) => { providerEventId: string, paymentId: string, state: 'authorized' | 'captured' | 'failed' | 'expired', amount: { amount: number, currency: 'PKR' }, providerRef: string }} [parseWebhook] verifies the signature over the raw body; throws when it is wrong
 */

/** @type {PaymentProvider} */
export const codProvider = { id: 'cod', configured: true, createSession: async () => ({ kind: 'none' }) }

/** Not selectable by customers: used when staff record money received outside the system. @type {PaymentProvider} */
export const manualProvider = { id: 'manual', configured: true, createSession: async () => ({ kind: 'none' }) }

/** `Rs. 2,500` for the line a customer reads. @param {number} paisa */
const rs = (paisa) => `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: paisa % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(paisa / 100)}`

/** The account to pay into and what to do after; the staff check the transfer and record it. @type {PaymentProvider} */
export const bankTransferProvider = {
  id: 'bank_transfer',
  configured: true,
  async createSession({ amount, orderNumber, bank }) {
    if (!bank) return { kind: 'none' }
    return { kind: 'instructions', text: `Send ${rs(amount.amount)} to ${bank.accountTitle}, ${bank.bank}, ${bank.accountNumber}. Write ${orderNumber} in the reference and send the receipt on WhatsApp.${bank.instructions ? ` ${bank.instructions}` : ''}` }
  },
}

/**
 * A gateway that behaves like the real ones will: a hosted page to redirect to, a signed callback, a retry that arrives twice.
 * @param {{ secret: string, id?: string }} o `id` is the payment method it stands in for (a gateway is registered under the method it serves)
 * @returns {PaymentProvider}
 */
export function fakeProvider({ secret, id = 'fake' }) {
  return {
    id,
    configured: true,
    async createSession({ paymentId, amount }) {
      return { kind: 'redirect', url: `https://fake-gateway.invalid/pay/${paymentId}?amount=${amount.amount}`, expiresAt: new Date(Date.now() + 30 * 60_000), providerRef: `fake-${paymentId}` }
    },
    parseWebhook(rawBody, headers) {
      const given = Buffer.from(String(headers['x-fake-signature'] ?? ''), 'hex')
      const wanted = createHmac('sha256', secret).update(rawBody).digest()
      if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) throw new DomainError('unauthenticated')
      const e = /** @type {{ eventId: string, paymentId: string, state: 'authorized' | 'captured' | 'failed' | 'expired', amountMinor: number, providerRef: string }} */ (JSON.parse(rawBody.toString('utf8')))
      return { providerEventId: e.eventId, paymentId: e.paymentId, state: e.state, amount: { amount: e.amountMinor, currency: 'PKR' }, providerRef: e.providerRef }
    },
  }
}

/** What a fake gateway would send, signed. For tests. @param {string} secret @param {object} event */
export function signedFakeEvent(secret, event) {
  const raw = Buffer.from(JSON.stringify(event))
  return { raw, headers: { 'x-fake-signature': createHmac('sha256', secret).update(raw).digest('hex'), 'content-type': 'application/json' } }
}

/**
 * The providers of this process, by id. Extra ones are for tests or a gateway added later.
 * @param {PaymentProvider[]} [extra]
 */
export function createProviders(extra = []) {
  const all = new Map([codProvider, manualProvider, bankTransferProvider, ...extra].map((p) => [p.id, p]))
  return {
    /** @param {string} id */
    get: (id) => all.get(id),
    /** Which methods have something behind them, for the settings screen. @param {string} method */
    configured: (method) => all.get(method)?.configured ?? false,
  }
}
