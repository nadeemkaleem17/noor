// Integration-test database: one scratch database per test file (DOC-13 section 3), created with the migration user, migrated,
// used through the app user, dropped afterwards. Tests are skipped, with a loud message, when MySQL is not reachable.
// This file is under test/, so it may read process.env (the config.js rule is for application code).
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import { createDatabase } from '../../src/platform/db.js'

const migrationUrl = process.env.DATABASE_MIGRATION_URL
const appUrl = process.env.DATABASE_URL
const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle')

/** @param {string} url @param {string} database */
const withDatabase = (url, database) => {
  const u = new URL(url)
  u.pathname = `/${database}`
  return u.toString()
}

async function reachable() {
  if (!migrationUrl || !appUrl) return false
  const server = createDatabase(withDatabase(migrationUrl, ''), 1)
  try {
    await server.pool.query('SELECT 1')
    return true
  } catch {
    return false
  } finally {
    await server.pool.end()
  }
}

/** True when the test database server answers. Use with `describe.skipIf(!dbAvailable)`. */
export const dbAvailable = await reachable()
if (!dbAvailable) console.warn('\n[integration tests skipped] MySQL is not reachable: start it and check DATABASE_URL / DATABASE_MIGRATION_URL in apps/api/.env\n')

/** Creates and migrates a fresh database; `drop()` removes it. */
export async function createTestDatabase() {
  const name = `rubaya_test_${randomBytes(4).toString('hex')}`
  const server = createDatabase(withDatabase(/** @type {string} */ (migrationUrl), ''), 1)
  await server.pool.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`)
  const m = createDatabase(withDatabase(/** @type {string} */ (migrationUrl), name), 2)
  await migrate(m.db, { migrationsFolder: migrations })
  await m.pool.end()
  const app = createDatabase(withDatabase(/** @type {string} */ (appUrl), name), 20)
  return {
    ...app,
    name,
    async drop() {
      await app.pool.end()
      await server.pool.query(`DROP DATABASE IF EXISTS \`${name}\``)
      await server.pool.end()
    },
  }
}
