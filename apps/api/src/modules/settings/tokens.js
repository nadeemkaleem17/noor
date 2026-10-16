// Placeholders in page text (plan/06-storefront/08-cms-pages.md section 2): policy copy says {{shipping.fee}} and the number comes from
// settings, so a price is never typed twice. Unknown tokens become nothing, never raw braces.

/** @typedef {{ freeAbove?: string, fee?: string, table?: string }} ShippingFacts ready-to-print amounts, e.g. "Rs. 3,000"; `table` is a Markdown list, one line for each delivery zone */

/** A WhatsApp number is kept as digits (923001234567); a page prints it the way a person reads a number: +92 300 1234567. Anything else is printed as it is. @param {string | undefined} digits */
const readable = (digits) => {
  const m = /^92(\d{3})(\d{7})$/.exec(digits ?? '')
  return m ? `+92 ${m[1]} ${m[2]}` : digits
}

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
    'store.whatsapp': readable(store.contact.whatsapp),
    'store.address': store.contact.address,
    'shipping.freeAbove': shipping.freeAbove,
    'shipping.fee': shipping.fee,
    'shipping.table': shipping.table,
    'returns.days': store.policies.returnsDays === undefined ? undefined : String(store.policies.returnsDays),
  }
  return text.replace(/\{\{\s*([A-Za-z]+\.[A-Za-z]+)\s*\}\}/g, (_, name) => values[name] ?? '')
}
