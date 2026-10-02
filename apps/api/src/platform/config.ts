// The only file that reads process.env (plan/08-backend-architecture.md section 12, enforced by lint).
// Parsed once at boot; a missing or invalid variable stops the process and names the variable.
import { z } from '@noor/contract'

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  APP_ENV: z.enum(['local', 'ci', 'staging', 'production']),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Exact origin of the admin app (CORS and CSRF). */
  ADMIN_ORIGIN: z.url(),
  /** Proxies in front of the API. 0 = trust nobody; never `true` (audit F-19). */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  /** Git SHA of the running build, shown to owners in admin.system.info. */
  APP_VERSION: z.string().default('dev'),
})

export type Config = Readonly<z.output<typeof Env>>

export class ConfigError extends Error {
  constructor(readonly variables: string[]) {
    super(`Invalid configuration: ${variables.join('; ')}`)
    this.name = 'ConfigError'
  }
}

export function parseConfig(env: Record<string, string | undefined>): Config {
  const r = Env.safeParse(env)
  if (r.success) return Object.freeze(r.data)
  throw new ConfigError(
    r.error.issues.map((i) => {
      const name = String(i.path[0])
      return `${name} (${env[name] === undefined ? 'required' : i.message})`
    }),
  )
}

export const loadConfig = (): Config => parseConfig(process.env)
