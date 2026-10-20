// Which colour a customer gets in the admin: the first enabled rule of each kind whose range holds the customer's count.
// The rules are rows staff edit (customer_highlight_rules), so nothing about ranges or colours is written here.

/**
 * @typedef {object} Rule
 * @property {string} id
 * @property {'orders' | 'visits'} kind
 * @property {number} minCount
 * @property {number | null} maxCount `null`: no upper limit
 * @property {string} color
 * @property {string} label
 * @property {boolean} enabled
 */

/** The order rules are tried from the lowest range up, so "1 to 5" is looked at before "6 to 10"; the id only makes the order stable. @param {Rule} a @param {Rule} b */
const byRange = (a, b) => a.minCount - b.minCount || a.id.localeCompare(b.id)

/** Does this rule hold for this count? @param {Rule} rule @param {number} count */
export const holds = (rule, count) => rule.enabled && count >= rule.minCount && (rule.maxCount === null || count <= rule.maxCount)

/**
 * At most one highlight per kind: when two ranges overlap, the one that starts lower wins.
 * @param {Rule[]} rules
 * @param {{ ordersCount: number, visitsCount: number }} counts
 * @returns {{ ruleId: string, kind: 'orders' | 'visits', label: string, color: string }[]}
 */
export function highlightsFor(rules, counts) {
  const sorted = rules.toSorted(byRange)
  return /** @type {const} */ (['orders', 'visits']).flatMap((kind) => {
    const count = kind === 'orders' ? counts.ordersCount : counts.visitsCount
    const rule = sorted.find((r) => r.kind === kind && holds(r, count))
    return rule ? [{ ruleId: rule.id, kind, label: rule.label, color: rule.color }] : []
  })
}
