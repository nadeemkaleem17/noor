import path from 'node:path'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// The old admin, kept runnable until its screens are rebuilt (M3): `pnpm --filter @noor/admin dev:old`, with legacy/mock-api on :3000.
export default defineConfig({
  root: import.meta.dirname,
  envDir: path.resolve(import.meta.dirname, '..'),
  server: { port: 5175, strictPort: true },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  // Tests always exercise the localStorage data layer. Without this, a developer's .env.local
  // (VITE_API_URL) would point the test suite at a running API and reset/overwrite its data.
  test: {
    env: { VITE_API_URL: '', VITE_ADMIN_KEY: '' },
  },
})
