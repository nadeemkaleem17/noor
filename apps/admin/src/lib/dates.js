import { formatDate } from '@noor/i18n/format'
// Staff see and enter times in Pakistan time (UTC+5, no daylight saving), whatever the browser's zone is.
const OFFSET_MS = 5 * 3_600_000

/** An ISO instant as the value of a `datetime-local` input ("2026-10-05T14:30"), in Pakistan time. @param {string | undefined} iso */
export const toLocalInput = (iso) => (iso ? new Date(new Date(iso).getTime() + OFFSET_MS).toISOString().slice(0, 16) : '')

/** The reverse: what a `datetime-local` input holds, read as Pakistan time, as an ISO instant. @param {string} local */
export const fromLocalInput = (local) => (local ? new Date(new Date(`${local}:00Z`).getTime() - OFFSET_MS).toISOString() : undefined)

/** "5 Oct 2026, 2:30 pm" in Pakistan time; `seconds` adds the seconds (audit entries). @param {string} iso @param {boolean} [seconds] */
export const formatDateTime = (iso, seconds = false) => formatDate(iso, 'en', { dateStyle: 'medium', timeStyle: seconds ? 'medium' : 'short' })

const units = /** @type {[Intl.RelativeTimeFormatUnit, number][]} */ ([['day', 86_400_000], ['hour', 3_600_000], ['minute', 60_000]])
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
/** "5 minutes ago", "in 5 days", "just now". @param {string} iso @param {number} [now] */
export function relativeTime(iso, now = Date.now()) {
  const diff = new Date(iso).getTime() - now
  const [unit, size] = units.find(([, ms]) => Math.abs(diff) >= ms) ?? ['minute', 60_000]
  return Math.abs(diff) < 60_000 ? 'just now' : relative.format(Math.round(diff / size), unit)
}
