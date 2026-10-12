import { cacheControl } from '~/lib/cache'
import { getEnv } from '~/lib/env.server'
import { sitemapIndexXml } from '~/lib/seo'
import { sitemapFiles } from '~/lib/seo.server'

// The list of sitemap files (plan/06-storefront/09-seo.md section 6).
export async function loader() {
  const files = await sitemapFiles()
  return new Response(sitemapIndexXml(getEnv().PUBLIC_SITE_URL, files.length), { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': cacheControl.resource } })
}
