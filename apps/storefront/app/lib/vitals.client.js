// Sends the field numbers (LCP, INP, CLS) of a visit to the shop's own server, after the page has loaded and when it is left (plan/06-storefront/10-performance.md section 9). Browser only.
import { vitalReport } from './vitals'

export function reportVitals() {
  if (import.meta.env.DEV) return // a laptop's numbers are not the shop's
  const start = () => {
    // a small separate chunk: the library is not in the bundle a page waits for
    void import('web-vitals').then(({ onCLS, onINP, onLCP }) => {
      const send = (/** @type {import('web-vitals').Metric} */ m) => {
        const body = JSON.stringify(vitalReport(m, location.pathname))
        // a beacon survives the page being closed; the blob type keeps it a plain JSON request
        if (!navigator.sendBeacon?.('/vitals', new Blob([body], { type: 'application/json' }))) void fetch('/vitals', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => undefined)
      }
      onLCP(send)
      onINP(send)
      onCLS(send)
    })
  }
  if (document.readyState === 'complete') start()
  else addEventListener('load', start, { once: true })
}
