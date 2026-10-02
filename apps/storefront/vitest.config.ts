import { defineConfig } from 'vitest/config'
import { base } from '@noor/config/vitest'

// Pure server helpers only; no React Router plugin here (route behaviour is checked with curl and Playwright, DOC-13)
export default defineConfig({ ...base, resolve: { alias: { '~': new URL('./app', import.meta.url).pathname } } })
