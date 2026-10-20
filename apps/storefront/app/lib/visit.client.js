// Tells the shop's server that a page was opened, at most once in 30 minutes for this tab, which is what a new visit is (the server decides that again). Browser only.
const GAP_MS = 30 * 60_000
const KEY = 'nc_visit_at'

export function reportVisit() {
  if (import.meta.env.DEV) return // a developer's own clicks are not visits
  const send = () => {
    try {
      const last = Number(sessionStorage.getItem(KEY) ?? 0)
      if (Date.now() - last < GAP_MS) return
      sessionStorage.setItem(KEY, String(Date.now()))
    } catch {
      // storage is blocked: the server alone decides
    }
    const body = JSON.stringify({ path: location.pathname })
    if (!navigator.sendBeacon?.('/visit', new Blob([body], { type: 'application/json' }))) void fetch('/visit', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => undefined)
  }
  send()
  // a tab left open for hours and used again is a new visit
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && send())
}
