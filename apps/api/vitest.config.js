import { defineConfig } from 'vitest/config'
import { base } from '@noor/config/vitest'

// Integration tests need the database URLs from apps/api/.env
try {
  process.loadEnvFile('.env')
} catch {
  // no .env: integration tests skip themselves
}

export default defineConfig(base)
