// Shared Vitest settings. Apps spread it: defineConfig({ ...base, test: { ...base.test, environment: 'jsdom' } })
export const base = {
  test: {
    environment: 'node',
    include: ['**/*.test.{ts,tsx,js}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
}
