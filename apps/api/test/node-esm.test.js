// The API is run by plain Node (ADR-0021), not by Vite: a file that only Vite can load (a JSON import without its attribute, a bare directory import) passes every
// test and then fails to start. This loads the entry points the way `pnpm start`, the worker and the seed do (found when M4-08's i18n import did exactly that).
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('under plain Node', () => {
  it('the app, the module list and the seed load without Vite', () => {
    const code = ["await import('./src/app.js')", "await import('./src/modules/index.js')", "await import('./src/seed/index.js')", "console.log('loaded')"].join(';')
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: root, encoding: 'utf8', timeout: 60_000 })
    expect(out.trim()).toBe('loaded')
  }, 90_000)
})
