import { reactCompilerPreset } from '@vitejs/plugin-react'
import react from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// The admin SPA (plan/03-frontend-architecture.md section 5.1). `@/` is src/.
export default defineConfig({
  server: { port: 5173, strictPort: true },
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), react(), babel({ presets: [reactCompilerPreset()] })],
})
