// Operator commands: `pnpm --filter @noor/api cli <command>`. Run with the same environment as the API (apps/api/.env).
//   owner:create --email owner@rubaya.pk --name "Owner Name"   creates the first owner; the password is typed at a hidden prompt
//   launch:check                                                what stands between this shop and opening (launch.js); exits 1 while there is a blocker
import path from 'node:path'
import readline from 'node:readline/promises'
import { Writable } from 'node:stream'
import { collectFacts, launchProblems } from './launch.js'
import { createAuthService } from './modules/auth/index.js'
import { createServices } from './modules/services.js'
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

/** @type {Record<string, (flags: Record<string, string>, auth: ReturnType<typeof createAuthService>, config: import('./platform/config.js').Config, db: import('./platform/db.js').Database['db']) => Promise<void>>} */
const commands = {
  async 'owner:create'(flags, auth, config) {
    const email = (flags.email ?? '').trim().toLowerCase()
    const name = (flags.name ?? '').trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) throw new Error('usage: owner:create --email owner@rubaya.pk --name "Owner Name"')
    const password = await askHidden(config.RELAXED_PASSWORDS ? 'Password (5 or more characters): ' : 'Password (12 or more characters): ')
    if (password !== (await askHidden('Again: '))) throw new Error('the two passwords differ')
    const id = await auth.createOwner({ email, name, password })
    console.log(`Owner created: ${email} (${id}). Sign in at the admin site; two-factor enrolment is required on first sign-in.`)
  },

  /** What stands between this shop and opening (launch.js). Exits 1 while there is a blocker. */
  async 'launch:check'(_flags, _auth, config, db) {
    const problems = launchProblems(await collectFacts({ db, ...createServices({ db, config }) }, config.APP_ENV))
    for (const p of problems) console.log(`${p.level === 'blocker' ? 'BLOCKER' : 'advice '}  ${p.where}: ${p.what}`)
    const blockers = problems.filter((p) => p.level === 'blocker').length
    console.log(blockers ? `\n${blockers} thing(s) to settle before the shop opens.` : '\nNothing stands in the way of opening.')
    if (blockers) process.exitCode = 1
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
      await run(parseFlags(rest), createAuthService({ db, config }), config, db)
    } finally {
      await pool.end()
    }
  } catch (e) {
    console.error(e instanceof DomainError ? `${e.code}${e.details.reason ? ` (${String(e.details.reason)})` : ''}` : e instanceof ConfigError || e instanceof Error ? e.message : String(e))
    process.exit(1)
  }
}
