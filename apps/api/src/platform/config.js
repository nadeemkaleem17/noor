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
  /** App user: data changes only (infra/mysql/init/01-users.sql). */
  DATABASE_URL: z.string().refine((v) => v.startsWith('mysql://'), 'must start with mysql://'),
  /** Migration user: DDL and data. Used only by db:migrate, db:seed and the retention job. */
  DATABASE_MIGRATION_URL: z.string().refine((v) => v.startsWith('mysql://'), 'must start with mysql://'),
  /** Connections per process. */
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  /** Run the job worker, outbox relay and scheduler inside the API process (local development only). */
  DEV_INLINE_WORKER: z.enum(['0', '1']).default('0').transform((v) => v === '1'),
  /** Git SHA of the running build, shown to owners in admin.system.info. */
  APP_VERSION: z.string().default('dev'),
})

/**
 * @typedef {Readonly<z.output<typeof Env>>} Config
 */

export class ConfigError extends Error {
  /**
   * @param {string[]} variables
   */
  constructor(variables) {
    super(`Invalid configuration: ${variables.join('; ')}`)
    this.variables = variables
    this.name = 'ConfigError'
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {Config}
 */
export function parseConfig(env) {
  const r = Env.safeParse(env)
  if (r.success) return Object.freeze(r.data)
  throw new ConfigError(
    r.error.issues.map((i) => {
      const name = String(i.path[0])
      return `${name} (${env[name] === undefined ? 'required' : i.message})`
    }),
  )
}

/**
 * @returns {Config}
 */
export const loadConfig = () => parseConfig(process.env)
