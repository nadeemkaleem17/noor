// Option and variant arithmetic of the product editor (plan/07-admin/03-products.md section 7). Pure functions: the screen only shows their answers.

/** A short random key that names an option value or variant inside the document before it has an id. */
export const newKey = () => `k${Math.random().toString(36).slice(2, 10)}`

/** @typedef {{ key: string; label: string; id?: string; }} ValueLike */
/** @typedef {{ values: ValueLike[]; }} OptionLike */
/** @typedef {{ key: string; optionValueKeys: string[]; id?: string; hasOrders?: boolean; enabled: boolean; sku?: string; }} VariantLike */

/** A combination as one string, whatever the order of its keys. @param {string[]} keys */
export const comboId = (keys) => [...keys].sort().join('|')

/**
 * Every combination of one value per option, in option order. A product without options has the one empty combination.
 * @param {OptionLike[]} options
 * @returns {string[][]}
 */
export function combinations(options) {
  return options.filter((o) => o.values.length > 0).reduce(/** @param {string[][]} acc */ (acc, o) => acc.flatMap((combo) => o.values.map((v) => [...combo, v.key])), [[]])
}

/**
 * What "Generate variants" would do: combinations that have no variant yet are added; variants of combinations that are gone are removed,
 * except those that appear on orders, which stay (disabled) because they cannot be deleted.
 * @template {VariantLike} V
 * @param {OptionLike[]} options @param {V[]} variants
 */
export function planVariants(options, variants) {
  const wanted = combinations(options)
  const wantedIds = new Set(wanted.map(comboId))
  const have = new Map(variants.map((v) => [comboId(v.optionValueKeys), v]))
  return {
    add: wanted.filter((c) => !have.has(comboId(c))),
    keep: variants.filter((v) => wantedIds.has(comboId(v.optionValueKeys))),
    remove: variants.filter((v) => !wantedIds.has(comboId(v.optionValueKeys)) && !v.hasOrders),
    disable: variants.filter((v) => !wantedIds.has(comboId(v.optionValueKeys)) && v.hasOrders),
  }
}

/** "M / Lawn": the labels of a combination, in option order. @param {OptionLike[]} options @param {string[]} keys */
export function variantLabel(options, keys) {
  const labels = new Map(options.flatMap((o) => o.values.map((v) => [v.key, v.label])))
  const ordered = options.flatMap((o) => o.values.filter((v) => keys.includes(v.key)).map((v) => v.label))
  return (ordered.length ? ordered : keys.map((k) => labels.get(k) ?? k)).join(' / ') || 'Default'
}

/**
 * The variants after generating: kept ones as they were (in combination order), disabled leftovers after them, new ones with empty SKU and price.
 * @template {VariantLike & Record<string, any>} V
 * @param {OptionLike[]} options @param {V[]} variants @param {(keys: string[]) => V} make a new variant for a combination
 * @returns {{ variants: V[]; added: number; removed: number; disabled: number; }}
 */
export function applyPlan(options, variants, make) {
  const plan = planVariants(options, variants)
  const kept = new Map(plan.keep.map((v) => [comboId(v.optionValueKeys), v]))
  const ordered = combinations(options).map((c) => kept.get(comboId(c)) ?? make(c))
  return {
    variants: [...ordered, ...plan.disable.map((v) => ({ ...v, enabled: false }))],
    added: plan.add.length,
    removed: plan.remove.length,
    disabled: plan.disable.length,
  }
}

/** The most variants a product may have. */
export const maxVariants = 100

/**
 * Whether a value may be taken out of an option: not while a variant that has orders uses it.
 * @param {VariantLike[]} variants @param {string} valueKey
 */
export const valueIsLocked = (variants, valueKey) => variants.some((v) => v.hasOrders && v.optionValueKeys.includes(valueKey))

/** A SKU from a prefix and the labels of a combination: "KURTA-M-LAWN". @param {string} prefix @param {string} label */
export const skuFrom = (prefix, label) =>
  `${prefix}-${label}`
    .toUpperCase()
    .replace(/[^A-Z0-9._]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
