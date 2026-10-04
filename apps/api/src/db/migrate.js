// `pnpm --filter @noor/api db:migrate`: applies the SQL files in ./drizzle with the migration user (DDL rights).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import { loadConfig } from '../platform/config.js'
import { createDatabase } from '../platform/db.js'

const config = loadConfig()
const { pool, db } = createDatabase(config.DATABASE_MIGRATION_URL, 2)
try {
  await migrate(db, { migrationsFolder: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle') })
  console.log('migrations applied')
} finally {
  await pool.end()
}
