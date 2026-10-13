// Validated once at boot. A missing or malformed variable stops the server and names the variable (plan/03 section 10).
import { z } from '@noor/contract'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_INTERNAL_URL: z.url(),
  PUBLIC_SITE_URL: z.url(),
  PUBLIC_IMG_URL: z.url(),
  PORT: z.coerce.number().int().default(5174),
  /** Shared secret that makes the API believe the visitor's address this server sends (same value as INTERNAL_KEY in the API's environment). */
  API_INTERNAL_KEY: z.string().min(32).optional(),
  /** Proxies in front of this server that write `X-Forwarded-For`. 0 = the header is not believed (and the API counts this server as the visitor). */
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
})

/**
 * @typedef {z.infer<typeof schema>} Env
 */

/**
 * @param {Record<string, string | undefined>} source
 * @returns {Env}
 */
export function parseEnv(source) {
  const result = schema.safeParse(source)
  if (result.success) return result.data
  const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${source[String(i.path[0])] === undefined ? 'is required' : i.message}`)
  throw new Error(`Invalid environment. ${problems.join('; ')}`)
}

/** @type {Env | undefined} */
let cached
/**
 * @returns {Env}
 */
export const getEnv = () => (cached ??= parseEnv(process.env))
