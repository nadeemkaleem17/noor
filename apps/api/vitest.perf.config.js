import { defineConfig } from 'vitest/config'
import { base } from '@noor/config/vitest'

try {
  process.loadEnvFile('.env')
} catch {
  // no .env: the performance run skips itself
}

// Its own configuration: the data takes minutes to build, so it is not part of `pnpm test`.
export default defineConfig({ ...base, test: { ...base.test, include: ['perf/**/*.test.js'], fileParallelism: false, hookTimeout: 900_000, testTimeout: 400_000 } })
