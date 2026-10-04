import { reactRouter } from '@react-router/dev/vite'
import { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // The server reads process.env (plan/03 section 10) but Vite only puts .env into import.meta.env, so copy it over for `dev`.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) process.env[key] ??= value
  return {
    server: { port: 5174, strictPort: true },
    plugins: [tailwindcss(), reactRouter(), babel({ presets: [reactCompilerPreset()] })],
  }
})
