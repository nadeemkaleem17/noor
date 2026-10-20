import { loadShell } from '~/lib/shell.server'
import { api } from '~/lib/api.server'
import { isRobot, newVisitor, refusesTracking, visitorCookie, visitorOf } from '~/lib/visit.server'

// A page was opened in this browser (see lib/visit.client.js): passed on to the API with the visitor's own number. Whatever happens, the answer is an empty 204, so a failure here is never
// something the visitor sees. Nothing is set or sent while the Store setting "Count visits" is off, or for a browser that asks not to be tracked.
/** @param {import('./+types/visit').Route.ActionArgs} props */
export async function action({ request }) {
  const quiet = { status: 204, headers: { 'Cache-Control': 'no-store' } }
  if (request.method !== 'POST') throw new Response('Method Not Allowed', { status: 405 })
  if (refusesTracking(request) || isRobot(request)) return new Response(null, quiet)
  const shell = await loadShell('en').catch(() => undefined)
  if (!shell || shell.config.features.visitTracking === false) return new Response(null, quiet)
  const body = await request.json().catch(() => undefined)
  const path = typeof body?.path === 'string' ? body.path.slice(0, 200) : '/'
  const known = visitorOf(request)
  const visitor = known ?? newVisitor()
  await api('visits.record', { body: { visitor, path } }).catch(() => undefined)
  return new Response(null, { ...quiet, headers: { ...quiet.headers, 'Set-Cookie': visitorCookie(visitor) } })
}
