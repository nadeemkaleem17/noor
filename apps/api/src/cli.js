// Operator commands: `pnpm --filter @noor/api cli <command>`. Run with the same environment as the API (apps/api/.env).
//   owner:create --email owner@rubaya.pk --name "Owner Name"   creates the first owner; the password is typed at a hidden prompt
import path from 'node:path'
import readline from 'node:readline/promises'
import { Writable } from 'node:stream'
import { createAuthService } from './modules/auth/index.js'
import { ConfigError, loadConfig } from './platform/config.js'
import { DomainError } from './platform/errors.js'
import { createAppDatabase } from './platform/db.js'

/** `--key value` pairs after the command name. @param {string[]} argv */
export function parseFlags(argv) {
  /** @type {Record<string, string>} */
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a?.startsWith('--')) flags[a.slice(2)] = argv[i + 1] && !argv[i + 1]?.startsWith('--') ? /** @type {string} */ (argv[++i]) : 'true'
  }
  return flags
}

/** Reads a line without echoing it. @param {string} question */
async function askHidden(question) {
  let muted = false
  const output = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk)
      cb()
    },
  })
  const rl = readline.createInterface({ input: process.stdin, output, terminal: true })
  process.stdout.write(question)
  muted = true
  const answer = await rl.question('')
  muted = false
  process.stdout.write('\n')
  rl.close()
  return answer
}

/** @type {Record<string, (flags: Record<string, string>, auth: ReturnType<typeof createAuthService>) => Promise<void>>} */
const commands = {
  async 'owner:create'(flags, auth) {
    const email = (flags.email ?? '').trim().toLowerCase()
    const name = (flags.name ?? '').trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) throw new Error('usage: owner:create --email owner@rubaya.pk --name "Owner Name"')
    const password = await askHidden('Password (12 or more characters): ')
    if (password !== (await askHidden('Again: '))) throw new Error('the two passwords differ')
    const id = await auth.createOwner({ email, name, password })
    console.log(`Owner created: ${email} (${id}). Sign in at the admin site; two-factor enrolment is required on first sign-in.`)
  },
}

if (path.basename(process.argv[1] ?? '') === 'cli.js') {
  const [command, ...rest] = process.argv.slice(2)
  const run = command ? commands[command] : undefined
  if (!run) {
    console.error(`Commands: ${Object.keys(commands).join(', ')}`)
    process.exit(2)
  }
  try {
    const config = loadConfig()
    const { pool, db } = createAppDatabase(config)
    try {
      await run(parseFlags(rest), createAuthService({ db, config }))
    } finally {
      await pool.end()
    }
  } catch (e) {
    console.error(e instanceof DomainError ? `${e.code}${e.details.reason ? ` (${String(e.details.reason)})` : ''}` : e instanceof ConfigError || e instanceof Error ? e.message : String(e))
    process.exit(1)
  }
}
