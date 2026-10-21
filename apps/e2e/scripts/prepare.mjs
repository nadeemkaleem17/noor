// Gets the machine ready for the journeys (plan/13-quality.md section 4): a scratch database that is migrated and seeded, a few staff accounts with a known
// password, and a build of the storefront and the admin for the scratch API. Run by `pnpm --filter @noor/e2e test`; `E2E_SKIP_BUILD=1` keeps the last build.
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { adminBuildEnv, apiEnv, dataDir, database, databaseUrls, password, root, staff, storefrontEnv } from '../env.mjs'

/** @param {string} command @param {string[]} args @param {string} cwd @param {Record<string, string>} [env] */
function run(command, args, cwd, env = {}) {
  const r = spawnSync(command, args, { cwd, env: { ...process.env, ...env }, stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${r.status})`)
}

rmSync(dataDir, { recursive: true, force: true })
mkdirSync(path.join(dataDir, 'storage'), { recursive: true })

// every API module reads its settings from process.env once, at load: set them first, then import
Object.assign(process.env, apiEnv())
const api = (/** @type {string} */ file) => import(new URL(`../../api/src/${file}`, import.meta.url).href)
const { createDatabase } = await api('platform/db.js')

const urls = databaseUrls()
const server = createDatabase(urls.server, 1)
try {
  await server.pool.query(`DROP DATABASE IF EXISTS \`${database}\``)
  await server.pool.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`)
} finally {
  await server.pool.end()
}

console.log('migrating...')
run('node', ['src/db/migrate.js'], path.join(root, 'apps/api'))

const { loadConfig } = await api('platform/config.js')
const { runSeed } = await api('seed/index.js')
const { createServices } = await api('modules/services.js')
const config = loadConfig()
const { db, pool } = createDatabase(config.DATABASE_MIGRATION_URL, 5)
try {
  console.log('seeding...')
  await runSeed({ db, config, flags: { demo: true }, log: (/** @type {string} */ line) => console.log(line) })
  const { auth } = createServices({ db, config })
  for (const person of Object.values(staff)) {
    await auth.createOwner({ email: person.email, name: person.name, password })
    if (person.role !== 'owner') await pool.query('UPDATE staff_users SET role = ? WHERE email = ?', [person.role, person.email])
  }
  // the journeys count visits without asking (a notice over the foot of every page would cover their buttons); 40-cookie-notice turns the question on for itself
  await pool.query("UPDATE settings SET value = JSON_SET(value, '$.features.visitConsent', false) WHERE `key` = 'store'")
} finally {
  await pool.end()
}

if (process.env.E2E_SKIP_BUILD !== '1') {
  console.log('building the storefront...')
  run('pnpm', ['--filter', '@noor/storefront', 'build'], root, storefrontEnv())
  console.log('building the admin...')
  run('pnpm', ['--filter', '@noor/admin', 'build'], root, adminBuildEnv())
}
console.log('ready')
