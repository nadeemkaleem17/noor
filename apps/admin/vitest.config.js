import { defineConfig } from 'vitest/config'
import { base } from '@noor/config/vitest'

// Two projects while the old admin still exists (old/ is deleted screen by screen from M3): the old one keeps its own Vite config.
export default defineConfig({
  test: {
    projects: [
      './old/vite.config.js',
      { ...base, resolve: { tsconfigPaths: true }, test: { ...base.test, name: 'admin', environment: 'jsdom', include: ['src/**/*.test.{js,jsx}'], setupFiles: ['./src/test/setup.js'] } },
    ],
  },
})
