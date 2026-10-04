// pnpm --filter @noor/api db:seed [--base-only] [--no-demo] [--perf]
import { ConfigError, loadConfig } from '../platform/config.js'
import { createDatabase } from '../platform/db.js'
import { runSeed } from '../seed/index.js'

const flags = {
  baseOnly: process.argv.includes('--base-only'),
  demo: !process.argv.includes('--no-demo'),
  perf: process.argv.includes('--perf'),
}

try {
  const config = loadConfig()
  const { db, pool } = createDatabase(config.DATABASE_MIGRATION_URL, 5)
  const started = Date.now()
  try {
    const result = await runSeed({ db, config, flags, log: (line) => console.log(line) })
    const owner = /** @type {{ email: string, password: string | null } | undefined} */ (result.owner)
    console.log(JSON.stringify(result, (k, v) => (k === 'password' ? undefined : v), 2))
    if (owner?.password) console.log(`\nLocal owner created: ${owner.email}\nPassword (shown once, write it down): ${owner.password}\n`)
    else if (owner) console.log(`\nLocal owner ${owner.email} already exists (password unchanged).`)
    console.log(`Done in ${Math.round((Date.now() - started) / 100) / 10} s.`)
  } finally {
    await pool.end()
  }
} catch (e) {
  if (e instanceof ConfigError) console.error(e.message)
  else console.error(e)
  process.exit(1)
}
