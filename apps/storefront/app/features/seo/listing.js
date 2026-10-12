// Which listing addresses are for the index (plan/06-storefront/09-seo.md section 5): the plain listing, and a few deliberate filter pages; everything else points back at the plain listing.

/**
 * @param {URLSearchParams} search the address's query
 * @param {{ key: string, seoIndexable?: boolean | undefined, values: { value: string, selected: boolean }[] }[]} [facets] the facets the API gave for it
 * @returns {{ index: boolean, query: string }} `query` is what the canonical address keeps: nothing, or the one facet value that is itself a page
 */
export function listingIndex(search, facets = []) {
  const keys = [...new Set(search.keys())].filter((k) => k !== 'chunk')
  if (keys.length === 0) return { index: true, query: '' }
  // exactly one parameter, one value, of an attribute the shop marked for the index
  if (keys.length === 1) {
    const key = /** @type {string} */ (keys[0])
    const values = search.getAll(key).flatMap((v) => v.split(',')).filter(Boolean)
    const facet = facets.find((f) => f.key === key)
    if (key.startsWith('attr.') && values.length === 1 && facet?.seoIndexable && facet.values.some((v) => v.selected && v.value === values[0])) {
      return { index: true, query: `?${encodeURIComponent(key)}=${encodeURIComponent(values[0] ?? '')}` }
    }
  }
  return { index: false, query: '' }
}
