// Small helpers mirroring the doc 03 §4.3 variant engine, admin-side only
// (full engine — resolveVariant, getOptionAvailability, etc. — lives in the storefront).

export function cartesianOptionValueIds(options) {
  if (options.length === 0) return [[]]
  return options.reduce(
    (acc, opt) => acc.flatMap((combo) => opt.values.map((v) => [...combo, v.id])),
    [[]],
  )
}

export function comboKey(ids) {
  return ids.join('::')
}

export function variantLabel(product, variant) {
  if (!variant.optionValueIds?.length) return '—'
  return variant.optionValueIds
    .map((valId, i) => {
      const opt = product.options[i]
      const val = opt?.values.find((v) => v.id === valId)
      return val?.label || valId
    })
    .join(' / ')
}

export function priceRange(product) {
  const prices = product.variants.map((v) => v.price.amount)
  return { min: Math.min(...prices), max: Math.max(...prices), currency: product.variants[0]?.price.currency || 'PKR' }
}

export function aggregateStock(product) {
  const statuses = product.variants.map((v) => v.stock.status)
  if (statuses.every((s) => s === 'sold_out')) return 'sold_out'
  if (statuses.some((s) => s === 'low_stock')) return 'low_stock'
  if (statuses.every((s) => s === 'made_to_order')) return 'made_to_order'
  return 'in_stock'
}