// What a visitor's choices on the product page come to (plan/06-storefront/04-pdp.md sections 4 to 6): which variant, whether a value can still be bought, what the stock line and the
// button say, how much can be ordered. Pure: the page, the server action for a visitor without JavaScript and the tests all use the same answers.

/** @typedef {import('@noor/contract').ProductDetail} ProductDetail */
/** @typedef {ProductDetail['options'][number]} Option */
/** @typedef {ProductDetail['variants'][number]} Variant */
/** What is chosen: option id to value id. @typedef {Record<string, string>} Chosen */

/** @param {Option[]} options @param {Variant[]} variants @param {Chosen} chosen @returns {Variant | undefined} the variant of a full choice; with no options the only variant */
export function variantFor(options, variants, chosen) {
  if (!options.length) return variants.length === 1 ? variants[0] : undefined
  if (options.some((o) => !chosen[o.id])) return undefined
  const ids = options.map((o) => /** @type {string} */ (chosen[o.id]))
  return variants.find((v) => v.optionValueIds.length === ids.length && ids.every((id) => v.optionValueIds.includes(id)))
}

/**
 * What is chosen before the visitor does anything: nothing, unless the product has one variant, or the address names a size (`?size=M`) the product has.
 * @param {Option[]} options @param {Variant[]} variants @param {string | null | undefined} sizeParam @returns {Chosen}
 */
export function initialChosen(options, variants, sizeParam) {
  if (variants.length === 1 && variants[0]) {
    const only = variants[0]
    return Object.fromEntries(options.flatMap((o) => { const v = o.values.find((x) => only.optionValueIds.includes(x.id)); return v ? [[o.id, v.id]] : [] }))
  }
  const size = options.find((o) => o.role === 'size')
  const named = size && sizeParam ? size.values.find((v) => v.label.toLowerCase() === sizeParam.toLowerCase()) : undefined
  return size && named ? { [size.id]: named.id } : {}
}

/** A value nobody can buy given the other choices made: every variant that has it is sold out (or none has it with them). @param {Variant[]} variants @param {Chosen} chosen @param {string} optionId @param {string} valueId */
export function valueSoldOut(variants, chosen, optionId, valueId) {
  const others = Object.entries(chosen).filter(([o]) => o !== optionId).map(([, v]) => v)
  return variants.filter((v) => v.optionValueIds.includes(valueId) && others.every((id) => v.optionValueIds.includes(id))).every((v) => v.stockStatus === 'sold_out')
}

/** @param {Variant} v @returns {{ kind: 'in_stock' | 'low' | 'sold_out' | 'made_to_order' | 'preorder', n?: number, date?: string }} */
export function stockLine(v) {
  if (v.stockStatus === 'sold_out') return { kind: 'sold_out' }
  if (v.stockStatus === 'made_to_order') return { kind: 'made_to_order' }
  if (v.stockStatus === 'preorder') return { kind: 'preorder', ...(v.preorderShipsAt ? { date: v.preorderShipsAt } : {}) }
  if (v.stockStatus === 'low_stock' || (v.available !== undefined && v.available <= 5)) return { kind: 'low', ...(v.available !== undefined ? { n: v.available } : {}) }
  return { kind: 'in_stock' }
}

/** The most that can go on one line: what is left and the limit per order, never less than one. @param {Variant} v */
export const maxQuantity = (v) => Math.max(1, Math.min(v.available ?? Infinity, v.maxPerOrder))

/**
 * What the add-to-cart button says and does (section 4): choose first, or the variant's own state.
 * @param {Option[]} options @param {Variant[]} variants @param {Chosen} chosen
 * @returns {{ state: 'select', missing: Option } | { state: 'sold_out' | 'preorder' | 'order' | 'add', variant: Variant } | { state: 'unavailable' }}
 */
export function buttonState(options, variants, chosen) {
  const missing = options.find((o) => !chosen[o.id])
  if (missing) return { state: 'select', missing }
  const variant = variantFor(options, variants, chosen)
  if (!variant) return { state: 'unavailable' }
  const kind = stockLine(variant).kind
  return { state: kind === 'sold_out' ? 'sold_out' : kind === 'preorder' ? 'preorder' : kind === 'made_to_order' ? 'order' : 'add', variant }
}

/** The price before a full choice: the lowest one, and whether the variants differ ("From ..."). @param {Variant[]} variants */
export function lowestPrice(variants) {
  const lowest = variants.reduce((a, b) => (b.price.amount < a.price.amount ? b : a), /** @type {Variant} */ (variants[0]))
  return { variant: lowest, varies: variants.some((v) => v.price.amount !== lowest.price.amount) }
}

/** Whether the chosen size is the one that is made to measure. @param {Option[]} options @param {Chosen} chosen */
export const isCustomSize = (options, chosen) => options.some((o) => o.values.some((v) => v.kind === 'custom' && chosen[o.id] === v.id))
