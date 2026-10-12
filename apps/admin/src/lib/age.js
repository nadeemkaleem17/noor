// How long something has waited, and when a wait turns urgent. Shared by the order screens and the dashboard (features do not import each other).

/** "20 min", "3 h", "2 d": how long ago an instant was. @param {string} iso @param {number} [now] */
export function ageText(iso, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  return hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} d`
}

/**
 * How urgent a wait is (plan/07-admin/05-orders.md section 5.1): an order that still needs a confirmation call turns warning after 2 hours and danger after 12.
 * @param {string} status @param {string} since an ISO instant @param {number} [now]
 * @returns {'neutral' | 'warning' | 'danger'}
 */
export function ageTone(status, since, now = Date.now()) {
  if (status !== 'pending_confirmation') return 'neutral'
  const hours = (now - new Date(since).getTime()) / 3_600_000
  return hours >= 12 ? 'danger' : hours >= 2 ? 'warning' : 'neutral'
}
