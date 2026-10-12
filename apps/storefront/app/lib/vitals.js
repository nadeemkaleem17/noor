// Field performance numbers (plan/06-storefront/10-performance.md section 9, DOC-12 section 6.1). Pure: the name of the kind of page, and what is sent about it.

/** The kind of page an address is, as the report's `route`: never the address itself, so no handle, token or search text leaves with a number. @param {string} pathname */
export function routeName(pathname) {
  const first = pathname.replace(/^\/ur(?=\/|$)/, '').split('/')[1] ?? ''
  const names = /** @type {Record<string, string>} */ ({ '': 'home', c: 'category', collections: 'collection', p: 'product', orders: 'order', pages: 'page' })
  return names[first] ?? (/^[a-z-]{1,30}$/.test(first) ? first : 'other')
}

/**
 * The body of one report, as `reporting.vitals` takes it.
 * @param {{ name: string, value: number, navigationType?: string }} metric
 * @param {string} pathname
 */
export const vitalReport = (metric, pathname) => ({ name: metric.name, value: Math.round(metric.value * 1000) / 1000, route: routeName(pathname), ...(metric.navigationType ? { navigationType: metric.navigationType } : {}) })
