// drizzle-kit: `pnpm --filter @noor/api db:generate` writes SQL migrations to ./drizzle; `db:migrate` applies them.
// Reads the migration user's URL straight from the environment (this file is outside src/, so the config.js rule does not apply).
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'mysql',
  schema: './src/db/schema/*.js',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_MIGRATION_URL ?? 'mysql://unset' },
})
