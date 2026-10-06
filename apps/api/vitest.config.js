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
// `perf/` is the performance run (`pnpm test:perf`): minutes of data building, so it has its own configuration.
// Coverage is measured only for the paths that carry a floor (plan/13-quality.md section 5); `pnpm test:coverage` checks the floors.
const coverage = {
  provider: /** @type {const} */ ('v8'),
  include: ['src/modules/cart/pricing.js', 'src/modules/cart/customization.js', 'src/modules/{promotions,orders,inventory,payments,auth}/**/*.js'],
  reporter: ['json-summary', 'text-summary'],
  reportsDirectory: '../../.data/cov',
}
export default defineConfig({ ...base, test: { ...base.test, exclude: [...base.test.exclude, 'perf/**'], fileParallelism: false, hookTimeout: 60_000, coverage } })
