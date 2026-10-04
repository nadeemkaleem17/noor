import { defineConfig } from 'vitest/config'
import { base } from '@noor/config/vitest'

// Integration tests need the database URLs from apps/api/.env
try {
  process.loadEnvFile('.env')
} catch {
  // no .env: integration tests skip themselves
}

// Files run one after another: each integration file hashes passwords with Argon2 (19 MiB per hash) and the whole repo's tests
// already run in parallel under turbo, so parallel files here made the worker processes run out of memory.
export default defineConfig({ ...base, test: { ...base.test, fileParallelism: false, hookTimeout: 60_000 } })
