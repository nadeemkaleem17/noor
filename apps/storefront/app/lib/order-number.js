/**
 * What a customer typed as an order number, in the one form the shop writes it: `RB-10458`. Spaces and case do not matter; the digits alone, or the old `NC` prefix, are accepted too
 * (plan/06-storefront/06-orders-tracking.md section 3). Anything else is passed on as typed (upper case): the API then answers "not found" like for any wrong number.
 * @param {string} input
 */
export function normalizeOrderNumber(input) {
  const text = input.trim().toUpperCase().replace(/\s+/g, '')
  const m = /^(?:RB|NC)?-?(\d{1,12})$/.exec(text)
  return m ? `RB-${m[1]}` : text
}
