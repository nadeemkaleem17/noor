// The period of the dashboard (plan/07-admin/02-dashboard.md section 4): a preset or a custom range, kept in the address, always in Pakistan days.
// Only days are worked out here, never money.

export const presets = /** @type {const} */ ([
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom range' },
])
export const DEFAULT_PERIOD = '7d'
export const MAX_DAYS = 366

/** The Pakistan day (UTC+5, no daylight saving) of an instant, `2026-10-12`. @param {number} [now] */
export const todayIn = (now = Date.now()) => new Date(now + 5 * 3_600_000).toISOString().slice(0, 10)

/** @param {string} day @param {number} n */
export const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** Days from `from` to `to`, both counted. @param {string} from @param {string} to */
export const daysIn = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1

/** @param {string | null} v @returns {v is string} */
const isDay = (v) => v !== null && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))

/**
 * The period the address asks for: `?period=today|yesterday|7d|30d|month`, or `?from=&to=` for a custom range of at most 366 days. Anything else is the default, last 7 days.
 * @param {URLSearchParams} search @param {number} [now]
 * @returns {{ id: string, from: string, to: string, days: number }}
 */
export function resolvePeriod(search, now = Date.now()) {
  const today = todayIn(now)
  const make = (/** @type {string} */ id, /** @type {string} */ from, /** @type {string} */ to) => ({ id, from, to, days: daysIn(from, to) })
  const from = search.get('from')
  const to = search.get('to')
  if (isDay(from) && isDay(to) && from <= to && daysIn(from, to) <= MAX_DAYS) return make('custom', from, to)
  switch (search.get('period')) {
    case 'today':
      return make('today', today, today)
    case 'yesterday':
      return make('yesterday', addDays(today, -1), addDays(today, -1))
    case '30d':
      return make('30d', addDays(today, -29), today)
    case 'month':
      return make('month', `${today.slice(0, 8)}01`, today)
    default:
      return make('7d', addDays(today, -6), today)
  }
}

/** The address for a preset, or for a custom range. @param {string} id @param {{ from?: string, to?: string }} [range] */
export function periodParams(id, range = {}) {
  if (id === 'custom') return { period: undefined, from: range.from, to: range.to }
  return { period: id === DEFAULT_PERIOD ? undefined : id, from: undefined, to: undefined }
}

/**
 * The change from the previous period as the arrow and the percent the tile shows: `null` when there is nothing before to compare with.
 * It is shown, not a figure of the shop: both numbers come from the API.
 * @param {number} current @param {number} previous
 */
export function change(current, previous) {
  if (previous <= 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  return { pct: Math.abs(pct), dir: pct > 0 ? /** @type {const} */ ('up') : pct < 0 ? /** @type {const} */ ('down') : /** @type {const} */ ('same') }
}
