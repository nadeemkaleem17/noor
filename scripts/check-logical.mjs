// Fails when JavaScript or CSS in the new code uses physical left/right styling (plan/04-design-system/tokens.md section 10).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scan } from '../packages/config/logical.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// apps/admin is not scanned: its old code is rewritten screen by screen from M3 and joins this list then
const found = scan(root, ['packages/ui', 'apps/storefront'])

if (found.length) {
  for (const h of found) console.error(`${h.file}:${h.line}  ${h.text}`)
  console.error(`\n${found.length} physical-direction use(s). Use logical utilities (ms-, pe-, start-, text-start ...) or add "physical: <reason>" on the line.`)
  process.exit(1)
}
console.log('no physical-direction styling found')
