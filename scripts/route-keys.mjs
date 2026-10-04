// Keeps the route table and the API docs honest (plan/10-api/08-admin-dashboard-ops.md section 6).
//   pnpm route-keys           write plan/10-api/route-keys.txt from packages/contract
//   pnpm route-keys --check   fail if a route in the contract is not described in plan/10-api/*.md;
//                             also reports how many documented routes are not built yet (progress, not a failure)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { routes } from '../packages/contract/src/table.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiDocs = path.join(root, 'plan/10-api')
const keys = Object.keys(routes).sort()

if (process.argv.includes('--check')) {
  const docs = readdirSync(apiDocs).filter((f) => f.endsWith('.md')).map((f) => readFileSync(path.join(apiDocs, f), 'utf8')).join('\n')
  // route keys documented in table rows: | `module.verbNoun` | ...
  const documented = new Set([...docs.matchAll(/^\| `([a-z]+(?:\.[a-zA-Z]+)+)`/gm)].map((m) => m[1]))
  const undocumented = keys.filter((k) => !docs.includes(`\`${k}\``))
  const notBuilt = [...documented].filter((k) => !keys.includes(k))
  console.log(`${keys.length} routes in the contract; ${notBuilt.length} documented routes not built yet.`)
  if (undocumented.length) {
    console.error(`Routes in the contract but not described in plan/10-api: ${undocumented.join(', ')}`)
    process.exit(1)
  }
} else {
  writeFileSync(path.join(apiDocs, 'route-keys.txt'), keys.join('\n') + '\n')
  console.log(`wrote plan/10-api/route-keys.txt (${keys.length} routes)`)
}
