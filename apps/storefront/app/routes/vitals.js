import { api } from '~/lib/api.server'

// The browser's performance numbers (plan/06-storefront/10-performance.md section 9): passed on to the API, which keeps daily figures per kind of page. A number that cannot be stored is not worth an
// error in the visitor's console, so every answer is 204.
/** @param {import('./+types/vitals').Route.ActionArgs} props */
export async function action({ request }) {
  if (request.method !== 'POST') throw new Response('Method Not Allowed', { status: 405 })
  const body = await request.json().catch(() => undefined)
  // the contract's own schema refuses anything that is not one of the three numbers, so a hand-made request cannot fill the table with other things
  await api('reporting.vitals', { body }).catch(() => undefined)
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
