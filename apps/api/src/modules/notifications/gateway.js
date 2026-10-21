// Text messages to a customer's phone (SMS or WhatsApp) through ONE gateway address the shop chooses (plan/12-integrations.md section 4). Any provider that takes a JSON POST fits, or a small
// bridge in front of one that does not. Without `MESSAGE_GATEWAY_URL` there is no gateway: the messages are only written to the log, as before.
//
// What the gateway receives: POST, `Authorization: Bearer <MESSAGE_GATEWAY_KEY>`, JSON `{ "to": "+923001234567", "text": "...", "reference": "<unique key of the message>" }`.
// Any 2xx answer means accepted; a JSON `id` (or `messageId`) in the answer is kept as the provider's reference. Anything else is a failure and the job is tried again.

/**
 * @typedef {object} Gateway
 * @property {(m: { to: string, text: string, reference: string }) => Promise<{ providerRef?: string }>} send
 */

/**
 * @param {{ MESSAGE_GATEWAY_URL?: string | undefined, MESSAGE_GATEWAY_KEY?: string | undefined }} config
 * @param {typeof fetch} [fetchImpl] for tests
 * @returns {Gateway | undefined}
 */
export function createGateway(config, fetchImpl = fetch) {
  const url = config.MESSAGE_GATEWAY_URL
  if (!url) return undefined
  return {
    async send({ to, text, reference }) {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(config.MESSAGE_GATEWAY_KEY ? { authorization: `Bearer ${config.MESSAGE_GATEWAY_KEY}` } : {}) },
        body: JSON.stringify({ to, text, reference }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) throw new Error(`the gateway answered ${res.status}`)
      const answer = /** @type {{ id?: unknown, messageId?: unknown } | undefined} */ (await res.json().catch(() => undefined))
      const ref = answer?.id ?? answer?.messageId
      return typeof ref === 'string' || typeof ref === 'number' ? { providerRef: String(ref).slice(0, 120) } : {}
    },
  }
}
