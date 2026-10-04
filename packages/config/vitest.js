// Shared Vitest settings. Apps spread it: defineConfig({ ...base, test: { ...base.test, environment: 'jsdom' } })
export const base = {
  test: {
    environment: 'node',
    testTimeout: 20_000, // turbo runs every package's tests at once; the default 5 s is too tight on a busy machine
    include: ['**/*.test.{ts,tsx,js}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
}
