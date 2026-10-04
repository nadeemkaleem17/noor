// Validated once at boot. A missing or malformed variable stops the server and names the variable (plan/03 section 10).
import { z } from '@noor/contract'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_INTERNAL_URL: z.url(),
  PUBLIC_SITE_URL: z.url(),
  PUBLIC_IMG_URL: z.url(),
  PORT: z.coerce.number().int().default(5174),
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
