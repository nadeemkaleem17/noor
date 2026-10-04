// Creates the local .env files and the MySQL init script (DOC-14 section 3.3, native MySQL, no Docker).
// Safe to rerun: an existing .env is never touched, and secrets already generated are reused (.data/local-secrets.json).
//   node scripts/setup-env.mjs
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fillTokens } from './lib/env-file.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, '.data')
const secretsFile = path.join(dataDir, 'local-secrets.json')
mkdirSync(dataDir, { recursive: true })

let secrets = existsSync(secretsFile) ? JSON.parse(readFileSync(secretsFile, 'utf8')) : {}
const created = []
const kept = []

for (const app of ['apps/api', 'apps/storefront']) {
  const example = path.join(root, app, '.env.example')
  const target = path.join(root, app, '.env')
  if (!existsSync(example)) continue
  if (existsSync(target)) {
    // an existing .env is never changed, but variables added to the example since are appended (with generated secrets)
    const have = new Set([...readFileSync(target, 'utf8').matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]))
    const wanted = readFileSync(example, 'utf8').split('\n')
    const missing = []
    for (let i = 0; i < wanted.length; i++) {
      const name = /^([A-Z][A-Z0-9_]*)=/.exec(wanted[i] ?? '')?.[1]
      if (name && !have.has(name)) missing.push(...(wanted[i - 1]?.startsWith('#') ? [wanted[i - 1]] : []), wanted[i])
    }
    if (missing.length) {
      const filled = fillTokens(missing.join('\n'), secrets)
      secrets = filled.secrets
      appendFileSync(target, (readFileSync(target, 'utf8').endsWith('\n') ? '' : '\n') + filled.text + '\n')
      created.push(`${app}/.env (added ${missing.filter((l) => !l.startsWith('#')).length} new variable(s))`)
    } else kept.push(`${app}/.env`)
    continue
  }
  const filled = fillTokens(readFileSync(example, 'utf8'), secrets)
  secrets = filled.secrets
  writeFileSync(target, filled.text)
  created.push(`${app}/.env`)
}

// the SQL that creates the database and its two users (DOC-11 section 6), with the same passwords as the .env files
const sqlTemplate = path.join(root, 'infra/mysql/init/01-users.sql')
const sqlOut = path.join(dataDir, 'mysql-init.sql')
const sql = fillTokens(readFileSync(sqlTemplate, 'utf8'), secrets)
secrets = sql.secrets
writeFileSync(sqlOut, sql.text)
writeFileSync(secretsFile, JSON.stringify(secrets, null, 2) + '\n', { mode: 0o600 })

console.log(created.length ? `Created: ${created.join(', ')}` : 'No new .env files.')
if (kept.length) console.log(`Left alone (already exist): ${kept.join(', ')}`)
console.log(`
Next, once, as the MySQL administrator (this is the only step that needs the root password):

  mysql -u root -p < .data/mysql-init.sql

If \`mysql\` is not on your PATH, it is in the MySQL install folder, for example
  "C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe" -u root -p < .data/mysql-init.sql
`)
