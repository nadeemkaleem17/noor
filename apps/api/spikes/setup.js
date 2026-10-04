// Shared by the spikes: a scratch database `rubaya_test_spike`, the real platform migration and the spike tables applied to it.
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import { loadConfig } from '../src/platform/config.js'
import { createDatabase } from '../src/platform/db.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const api = path.resolve(here, '..')
export const SPIKE_DB = 'rubaya_test_spike'

/** @param {string} url @param {string} database */
const withDatabase = (url, database) => {
  const u = new URL(url)
  u.pathname = `/${database}`
  return u.toString()
}

/** Connection URLs for the migration user and the app user, pointed at the scratch database. */
export function spikeUrls() {
  const config = loadConfig()
  return { migrate: withDatabase(config.DATABASE_MIGRATION_URL, SPIKE_DB), app: withDatabase(config.DATABASE_URL, SPIKE_DB), server: withDatabase(config.DATABASE_MIGRATION_URL, '') }
}

/** Drops and recreates the scratch database, then applies the platform migration and a freshly generated spike migration. */
export async function resetSpikeDatabase() {
  const urls = spikeUrls()
  const server = createDatabase(urls.server, 1)
  await server.pool.query(`DROP DATABASE IF EXISTS \`${SPIKE_DB}\``)
  await server.pool.query(`CREATE DATABASE \`${SPIKE_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`)
  await server.pool.end()

  const out = path.join(api, '.data', 'spike-migrations')
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  execFileSync('pnpm', ['exec', 'drizzle-kit', 'generate', '--dialect', 'mysql', '--schema', './spikes/spike-schema.js', '--out', out, '--name', 'spike'], { cwd: api, stdio: 'pipe', shell: true })

  const m = createDatabase(urls.migrate, 2)
  await migrate(m.db, { migrationsFolder: path.join(api, 'drizzle') })
  await migrate(m.db, { migrationsFolder: out, migrationsTable: '__spike_migrations' })
  await m.pool.end()
  return urls
}
