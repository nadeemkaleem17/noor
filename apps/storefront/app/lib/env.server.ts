// Validated once at boot. A missing or malformed variable stops the server and names the variable (plan/03 section 10).
import { z } from '@noor/contract'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_INTERNAL_URL: z.url(),
  PUBLIC_SITE_URL: z.url(),
  PUBLIC_IMG_URL: z.url(),
  PORT: z.coerce.number().int().default(5174),
})

export type Env = z.infer<typeof schema>

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source)
  if (result.success) return result.data
  const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${source[String(i.path[0])] === undefined ? 'is required' : i.message}`)
  throw new Error(`Invalid environment. ${problems.join('; ')}`)
}

let cached: Env | undefined
export const getEnv = (): Env => (cached ??= parseEnv(process.env))
