import { defineConfig } from 'vitest/config'
import { base } from '@noor/config/vitest'

export default defineConfig({
  ...base,
  resolve: { tsconfigPaths: true },
  test: { ...base.test, testTimeout: 60_000, name: 'admin', environment: 'jsdom', include: ['src/**/*.test.{js,jsx}'], setupFiles: ['./src/test/setup.js'] },
})
