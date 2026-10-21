// Tells the shop's server that a page was opened, at most once in 30 minutes for this tab, which is what a new visit is (the server decides that again). Browser only.
// The server counts nothing for a visitor who has not said yes when the shop asks first (see routes/visit.js); these calls are only the telling.
const GAP_MS = 30 * 60_000
const KEY = 'nc_visit_at'

/** @param {Record<string, unknown>} fields */
function post(fields) {
  const body = JSON.stringify({ path: location.pathname, ...fields })
  if (!navigator.sendBeacon?.('/visit', new Blob([body], { type: 'application/json' }))) void fetch('/visit', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => undefined)
}

/** @param {boolean} force a new answer from the visitor: the stay so far counts now */
function send(force = false) {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0)
    if (!force && Date.now() - last < GAP_MS) return
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // storage is blocked: the server alone decides
  }
  post({})
}

export function reportVisit() {
  if (import.meta.env.DEV) return // a developer's own clicks are not visits
  send()
  // a tab left open for hours and used again is a new visit
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && send())
}

/** The visitor has just said yes: this stay is counted from now. */
export function reportVisitNow() {
  if (!import.meta.env.DEV) send(true)
}

/** The visitor has just said no: the server forgets the number it may have set. */
export function forgetVisit() {
  if (!import.meta.env.DEV) post({ forget: true })
}
