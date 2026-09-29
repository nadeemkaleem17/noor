import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
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
