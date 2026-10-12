import { cacheControl } from '~/lib/cache'
import { getEnv } from '~/lib/env.server'
import { robotsTxt } from '~/lib/seo'

// What a crawler may fetch (plan/06-storefront/09-seo.md section 6). Anywhere but the shop's own address: nothing.
export function loader() {
  return new Response(robotsTxt(getEnv().PUBLIC_SITE_URL), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': cacheControl.resource } })
}
