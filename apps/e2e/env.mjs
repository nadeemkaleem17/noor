// What the end-to-end run needs to know, in one place: ports, addresses, the scratch database and the people who sign in.
// Read by scripts/prepare.mjs (builds and fills the database), by playwright.config.js (starts the three servers) and by the tests.
// Everything here is for a scratch database on this machine (APP_ENV=ci); none of it is a real secret.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const dataDir = path.join(root, '.data/e2e')

export const ports = { api: 3100, storefront: 4174, admin: 4173 }
const host = '127.0.0.1'
export const urls = {
  api: `http://${host}:${ports.api}`,
  storefront: `http://${host}:${ports.storefront}`,
  admin: `http://${host}:${ports.admin}`,
}

export const database = 'rubaya_test_e2e'
const internalKey = 'e2e-internal-key-0123456789abcdef0123456789'

/** The database addresses: from the environment (CI) or from apps/api/.env (this machine), with the scratch database name. */
export function databaseUrls() {
  const file = (() => {
    try {
      return parseEnv(readFileSync(path.join(root, 'apps/api/.env'), 'utf8'))
    } catch {
      return {}
    }
  })()
  const pick = (/** @type {string} */ name) => {
    const value = process.env[name] ?? file[name]
    if (!value) throw new Error(`${name} is not set: start MySQL and fill apps/api/.env (or set it in the environment)`)
    return value
  }
  const named = (/** @type {string} */ url, /** @type {string} */ db) => {
    const u = new URL(url)
    u.pathname = `/${db}`
    return u.toString()
  }
  const migrationUrl = pick('DATABASE_MIGRATION_URL')
  return { server: named(migrationUrl, ''), migration: named(migrationUrl, database), app: named(pick('DATABASE_URL'), database) }
}

/** Environment of the API process. */
export function apiEnv() {
  const db = databaseUrls()
  return {
    NODE_ENV: 'development',
    APP_ENV: 'ci',
    HOST: host,
    PORT: String(ports.api),
    LOG_LEVEL: 'warn',
    ADMIN_ORIGIN: urls.admin,
    API_PUBLIC_URL: urls.api,
    IMG_BASE_URL: `${urls.api}/img`,
    STOREFRONT_URL: urls.storefront,
    INTERNAL_KEY: internalKey,
    DATABASE_URL: db.app,
    DATABASE_MIGRATION_URL: db.migration,
    DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    SESSION_COOKIE_NAME: 'rb_admin_e2e',
    DEV_INLINE_WORKER: '1',
    STORAGE_DRIVER: 'local',
    LOCAL_STORAGE_DIR: path.join(dataDir, 'storage'),
    TWO_FACTOR_REQUIRED: '1',
  }
}

/** Environment of the storefront server. */
export function storefrontEnv() {
  return {
    NODE_ENV: 'production',
    HOST: host,
    PORT: String(ports.storefront),
    API_INTERNAL_URL: urls.api,
    PUBLIC_SITE_URL: urls.storefront,
    PUBLIC_IMG_URL: `${urls.api}/img`,
    API_INTERNAL_KEY: internalKey,
    TRUSTED_PROXY_HOPS: '1',
  }
}

/** Environment of the admin build (the API address is baked into the files). */
// NODE_ENV: prepare.mjs puts the API's environment (development) into its own process.env, which a build inherits: without this the admin was built with React's development runtime (about 70 kB more, not what staff get)
export const adminBuildEnv = () => ({ NODE_ENV: 'production', VITE_API_URL: urls.api, VITE_STOREFRONT_URL: urls.storefront })

export const password = 'Lantern-Quarry-48-Plover'

/** The staff made by the prepare step. `enrol`: the global setup sets up their two-step code (and keeps it in secrets.json); a viewer needs none; the fresh owner does it in a journey. */
export const staff = {
  owner: { email: 'e2e-owner@rubaya.test', name: 'E2E Owner', role: 'owner', enrol: true },
  fresh: { email: 'e2e-fresh@rubaya.test', name: 'E2E Fresh Owner', role: 'owner', enrol: false },
  viewer: { email: 'e2e-viewer@rubaya.test', name: 'E2E Viewer', role: 'viewer', enrol: false },
}

export const secretsFile = path.join(dataDir, 'secrets.json')
