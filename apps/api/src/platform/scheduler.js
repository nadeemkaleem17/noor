// Scheduled jobs without a cron service (DOC-08 section 9.2): a static list of `{ type, cron }`; every minute the worker enqueues the
// ones due, with the unique key `schedule:<type>:<minute>`, so two workers enqueue each at most once. Cron is evaluated in UTC
// (PKT is UTC+5: "daily 03:00 PKT" is `0 22 * * *`).
import { enqueue } from './jobs.js'

/**
 * @typedef {object} ScheduledJob
 * @property {string} type
 * @property {string} cron five fields: minute hour day-of-month month day-of-week; each `*`, `*&#47;n`, `a`, `a-b` or a comma list
 */

/** The platform's own schedule. Modules add their entries when they are built (DOC-08 section 9.2 lists them). @type {ScheduledJob[]} */
export const platformSchedule = [
  { type: 'outbox.cleanup', cron: '30 21 * * *' }, // daily, 02:30 PKT
  { type: 'idempotency.cleanup', cron: '5 * * * *' }, // hourly
]

/**
 * @param {string} field
 * @param {number} value
 * @param {number} min
 */
function fieldMatches(field, value, min) {
  return field.split(',').some((part) => {
    const [range = '', stepText] = part.split('/')
    const step = stepText === undefined ? 1 : Number(stepText)
    if (!Number.isInteger(step) || step < 1) throw new Error(`bad cron step in "${field}"`)
    let [from, to] = [min, Infinity]
    if (range !== '*') {
      const [a = '', b] = range.split('-')
      from = Number(a)
      to = b === undefined ? (stepText === undefined ? from : Infinity) : Number(b)
      if (!Number.isInteger(from) || !Number.isInteger(to)) throw new Error(`bad cron field "${field}"`)
    }
    return value >= from && value <= to && (value - from) % step === 0
  })
}

/**
 * Whether a five-field cron expression matches this minute (UTC).
 * @param {string} cron
 * @param {Date} date
 */
export function cronMatches(cron, date) {
  const f = cron.trim().split(/\s+/)
  if (f.length !== 5) throw new Error(`cron needs five fields: "${cron}"`)
  const [min, hour, dom, mon, dow] = /** @type {[string, string, string, string, string]} */ (f)
  return (
    fieldMatches(min, date.getUTCMinutes(), 0) &&
    fieldMatches(hour, date.getUTCHours(), 0) &&
    fieldMatches(dom, date.getUTCDate(), 1) &&
    fieldMatches(mon, date.getUTCMonth() + 1, 1) &&
    fieldMatches(dow, date.getUTCDay(), 0)
  )
}

/** `202610040330`: the minute a scheduled run belongs to. @param {Date} date */
const minuteBucket = (date) => date.toISOString().slice(0, 16).replace(/[-T:]/g, '')

/**
 * Enqueues every scheduled job that is due this minute. Safe to call many times, from many workers.
 * @param {import('./db.js').Executor} db
 * @param {ScheduledJob[]} schedule
 * @param {Date} at
 * @returns {Promise<string[]>} types that were due
 */
export async function enqueueDue(db, schedule, at) {
  const due = schedule.filter((s) => cronMatches(s.cron, at))
  for (const s of due) await enqueue(db, { type: s.type, payload: {}, uniqueKey: `schedule:${s.type}:${minuteBucket(at)}` }, at)
  return due.map((s) => s.type)
}
