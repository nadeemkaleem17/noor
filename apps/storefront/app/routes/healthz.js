// Liveness for the host (plan/06-storefront/01-sitemap.md section 2): the process is up. No page, no API call.
export function loader() {
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
