// `db:seed` (plan/14-devops.md section 5.2): base data, the local owner, the demo shop, and optionally the performance data.
import { createServices } from '../modules/services.js'
import { seedBase } from './base.js'
import { seedDemo } from './demo.js'
import { seedOwner } from './owner.js'
import { seedPerf } from './perf.js'

/**
 * @param {object} o
 * @param {import('../platform/db.js').Database['db']} o.db the migration user's handle: the seed writes everywhere
 * @param {import('../platform/config.js').Config} o.config
 * @param {{ baseOnly?: boolean, demo?: boolean, perf?: boolean }} [o.flags] `baseOnly` is the only layer allowed in production; `demo` defaults to on; `perf` builds the 3,000-product database
 * @param {(line: string) => void} [o.log]
 */
export async function runSeed({ db, config, flags = {}, log = () => {} }) {
  if (config.APP_ENV === 'production' && !flags.baseOnly) throw new Error('refusing to seed demo data in production: use --base-only')
  const services = createServices({ db, config })
  /** @type {Record<string, Record<string, number> | { id: string, email: string, password: string | null }>} */
  const result = {}
  log('base...')
  result.base = await seedBase(db, { search: services.search })
  if (flags.baseOnly) return result

  log('owner...')
  const owner = await seedOwner(db, services.auth)
  result.owner = owner
  if (flags.demo !== false || flags.perf) {
    const actor = { staffId: owner.id, name: 'Local Owner', role: 'owner', canPublish: true }
    log('demo shop (pictures take a moment)...')
    result.demo = await seedDemo(db, services, actor, { log })
  }
  if (flags.perf) {
    log('performance data...')
    result.perf = await seedPerf(db, { search: services.search, log })
  }
  return result
}
