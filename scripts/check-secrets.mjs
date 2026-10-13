// Fails when a tracked file holds something that looks like a credential (plan/11-security-auth.md sections 7 and 13). Part of `pnpm check`.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scan } from '../packages/config/secrets.js'

const found = scan(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'))
if (found.length) {
  for (const f of found) console.error(`${f.file}:${f.line}  ${f.what}`)
  console.error(`\n${found.length} possible secret(s) in tracked files. Remove them (and rotate what they opened); names belong in .env.example, values in the host's secret store.`)
  process.exit(1)
}
console.log('no secrets found in tracked files')
