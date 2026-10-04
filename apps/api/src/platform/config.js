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
  /** Shared secret of the storefront server (X-Internal-Key). Only a request carrying it may say which client address to rate-limit. */
  INTERNAL_KEY: z.string().min(32).optional(),
  /** Connections per process. */
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  /** 32 random bytes, base64: encrypts staff TOTP secrets (AES-256-GCM). */
  DATA_ENCRYPTION_KEY: z.string().refine((v) => /^[A-Za-z0-9+/]{43}=$/.test(v) && Buffer.from(v, 'base64').length === 32, 'must be 32 bytes in base64'),
  /** Staff session cookie name. Production uses the __Host- prefix (needs HTTPS). */
  SESSION_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]{3,40}$/).default('__Host-rb_admin'),
  /** Run the job worker, outbox relay and scheduler inside the API process (local development only). */
  DEV_INLINE_WORKER: z.enum(['0', '1']).default('0').transform((v) => v === '1'),
  /** Where files live. Only `local` (a folder, development only) exists yet; the S3 driver comes with deployment (plan/14-devops.md). */
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  LOCAL_STORAGE_DIR: z.string().min(1).default('.data/storage'),
  /** Public address of this API as a browser reaches it: the local driver's upload links point here. */
  API_PUBLIC_URL: z.url().default('http://localhost:3000'),
  /** Public base of the image host. With IMAGE_TRANSFORM=none the API itself serves it at /img (local driver). */
  IMG_BASE_URL: z.url().default('http://localhost:3000/img'),
  /** Public address of the storefront: preview links point here. */
  STOREFRONT_URL: z.url().default('http://localhost:5174'),
  /** Git SHA of the running build, shown to owners in admin.system.info. */
  APP_VERSION: z.string().default('dev'),
}).superRefine((env, ctx) => {
  // plan/14-devops.md section 6: a production process never keeps files on its own disk
  if (env.NODE_ENV === 'production' && env.STORAGE_DRIVER === 'local') {
    ctx.addIssue({ code: 'custom', path: ['STORAGE_DRIVER'], message: 'local storage is for development only' })
  }
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
      return `${name} (${env[name] === undefined && i.code !== 'custom' ? 'required' : i.message})`
    }),
  )
}

/**
 * @returns {Config}
 */
export const loadConfig = () => parseConfig(process.env)
