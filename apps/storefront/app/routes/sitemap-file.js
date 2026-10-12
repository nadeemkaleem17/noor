import { cacheControl } from '~/lib/cache'
import { getEnv } from '~/lib/env.server'
import { sitemapXml } from '~/lib/seo'
import { sitemapFiles } from '~/lib/seo.server'

// One file of the sitemap: up to 5,000 addresses. A number that is not one of them is a 404.
/** @param {import('./+types/sitemap-file').Route.LoaderArgs} props */
export async function loader({ params }) {
  const files = await sitemapFiles()
  const file = /^\d+$/.test(params.n ?? '') ? files[Number(params.n) - 1] : undefined
  if (!file) throw new Response('Not Found', { status: 404 })
  return new Response(sitemapXml(getEnv().PUBLIC_SITE_URL, file), { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': cacheControl.resource } })
}
