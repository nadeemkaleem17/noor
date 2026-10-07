// What every listing page's loader does the same (plan/06-storefront/03-plp-search.md section 8): one canonical address, one call for the products and their facets, and an
// answer for each way it can go wrong. Never imported by browser code.
import { redirect } from 'react-router'
import { ApiError } from '@noor/contract'
import { api } from './api.server'
import { localeOfPath } from './locale'
import { pagePath } from './paths'
import { canonicalQuery } from './redirects'
import { loadShell } from './shell.server'

export const PAGE_SIZE = 24

/** @type {import('@noor/contract').ProductListing} */
const NONE = { items: [], total: 0 }

/** A missing category or collection is a 404; anything else is not this function's to answer. @param {unknown} e @returns {never} */
export function orNotFound(e) {
  if (e instanceof ApiError && e.code === 'not_found') throw new Response('Not Found', { status: 404 })
  throw e
}

/** A query the API would refuse (a size nobody sells, a bad number): the visitor is sent to the listing without it rather than shown an error. @param {unknown} e */
const refused = (e) => (e instanceof ApiError && e.code === 'validation_failed') || (e instanceof Error && e.name === 'ZodError')

/**
 * @param {object} props
 * @param {Request} props.request
 * @param {Record<string, string | boolean>} props.filter what makes this listing what it is: `{ category: 'lawn' }`, `{ onlyNew: true }` ...
 * @param {string} [props.sort] the sort when the address names none
 * @returns {Promise<{ page: import('@noor/contract').ProductListing, failed: boolean, brand: string }>} `failed` is only ever true for a fetcher's `chunk` request, whose page is then empty
 */
export async function loadListing({ request, filter, sort }) {
  const url = new URL(request.url)
  const locale = localeOfPath(url.pathname)
  // a fetcher asking for one more page says `chunk`; it gets an answer it can show, never an error page, and no redirect
  const chunk = url.searchParams.has('chunk')
  const canonical = canonicalQuery(url.searchParams)
  if (!chunk) {
    // compared by what the parameters say, not how they are written (`,` and `%2C` are the same), so a canonical address never bounces
    if (new URLSearchParams(canonical).toString() !== new URLSearchParams(url.search).toString()) throw redirect(pagePath(url) + canonical, 301)
  }
  const query = { ...Object.fromEntries(new URLSearchParams(canonical)), ...filter, locale, limit: PAGE_SIZE }
  if (sort && !('sort' in query)) Object.assign(query, { sort })
  const { config } = await loadShell(locale)
  try {
    const page = await api('catalog.listProducts', { query: /** @type {never} */ (query) })
    return { page, failed: false, brand: config.brand.name }
  } catch (e) {
    if (chunk) return { page: NONE, failed: true, brand: config.brand.name }
    if (refused(e)) throw redirect(pagePath(url), 302)
    return orNotFound(e)
  }
}
