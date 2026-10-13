import { reactCompilerPreset } from '@vitejs/plugin-react'
import react from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import { adminHeaders, headersFile } from './security-headers.js'

// The admin SPA (plan/03-frontend-architecture.md section 5.1). `@/` is src/.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const where = { api: env.VITE_API_URL ?? 'http://localhost:3000' }
  return {
    server: { port: 5173, strictPort: true },
    // `vite preview` serves the built files with the headers a real host would send
    preview: { headers: adminHeaders(where) },
    resolve: { tsconfigPaths: true },
    plugins: [
      tailwindcss(),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      { name: 'admin-headers-file', apply: 'build', closeBundle: () => writeFileSync(path.resolve('dist/_headers'), headersFile(where)) },
    ],
  }
})
