// Windows quirk: after `pnpm install` the `jsdom` link inside a `vitest` folder of node_modules/.pnpm can point at the repo root
// instead of jsdom, and every jsdom test then fails with "Cannot find package". This repairs the link. Runs as `postinstall`; harmless elsewhere.
import { existsSync, lstatSync, readdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const store = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', '.pnpm')
if (existsSync(store)) {
  const jsdom = readdirSync(store).find((d) => d.startsWith('jsdom@'))
  if (jsdom) {
    const target = path.join(store, jsdom, 'node_modules', 'jsdom')
    for (const dir of readdirSync(store).filter((d) => d.startsWith('vitest@'))) {
      const link = path.join(store, dir, 'node_modules', 'jsdom')
      if (!existsSync(link) && !(() => { try { return lstatSync(link).isSymbolicLink() } catch { return false } })()) continue
      if (existsSync(link) && realpathSync(link) === realpathSync(target)) continue // fine
      rmSync(link, { force: true, recursive: false })
      symlinkSync(target, link, 'junction')
      console.log(`repaired ${path.relative(store, link)}`)
    }
  }
}
