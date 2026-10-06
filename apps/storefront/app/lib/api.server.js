// The storefront server's one way to the API (plan/03 section 7): the typed client, parsed responses, a time limit. Never imported by browser code.
import { createClient, routes } from '@noor/contract'
import { getEnv } from './env.server'

export const api = createClient(routes, { baseUrl: `${getEnv().API_INTERNAL_URL}/api/v1`, timeoutMs: 8_000 })

/**
 * The handle of a product known by an old id or by anything the API accepts (`/product/42` of the old shop). Only the handle is wanted, so this reads just that
 * instead of the whole product page.
 * @param {string} idOrHandle
 * @returns {Promise<string | undefined>} undefined when there is no such product
 */
export async function handleOf(idOrHandle) {
  const res = await fetch(`${getEnv().API_INTERNAL_URL}/api/v1/products/${encodeURIComponent(idOrHandle)}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8_000) })
  if (!res.ok) return undefined
  const body = /** @type {{ handle?: unknown, redirectTo?: unknown }} */ (await res.json())
  const handle = body.redirectTo ?? body.handle
  return typeof handle === 'string' ? handle : undefined
}
