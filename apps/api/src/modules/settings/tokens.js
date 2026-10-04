// Placeholders in page text (plan/06-storefront/08-cms-pages.md section 2): policy copy says {{shipping.fee}} and the number comes from
// settings, so a price is never typed twice. Unknown tokens become nothing, never raw braces.

/** @typedef {{ freeAbove?: string, fee?: string }} ShippingFacts ready-to-print amounts, e.g. "Rs. 3,000" */

/**
 * @param {string} text
 * @param {import('@noor/contract').StoreSettings} store
 * @param {ShippingFacts} shipping
 */
export function resolveTokens(text, store, shipping) {
  /** @type {Record<string, string | undefined>} */
  const values = {
    'store.phone': store.contact.phone,
    'store.email': store.contact.email,
    'store.whatsapp': store.contact.whatsapp,
    'store.address': store.contact.address,
    'shipping.freeAbove': shipping.freeAbove,
    'shipping.fee': shipping.fee,
    'returns.days': store.policies.returnsDays === undefined ? undefined : String(store.policies.returnsDays),
  }
  return text.replace(/\{\{\s*([A-Za-z]+\.[A-Za-z]+)\s*\}\}/g, (_, name) => values[name] ?? '')
}
