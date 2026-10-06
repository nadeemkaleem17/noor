// M5-01 (plan/06-storefront/01-sitemap.md section 8): the real storefront, built and started, against a stand-in API. Every address of the URL map answers with its cache class,
// the home page holds nothing of a visitor, the old shop's addresses are redirected, `/ur` is not a page until Urdu is on, and a dead API gives a 503 that is never cached.
// It builds the app first (about a minute), so it is slow; it is the only test that goes through the whole stack of React Router, the shell and the headers.
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { StoreConfigPublic, themePresets } from '@noor/contract'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const state = { down: false, ur: false }
const image = { src: 'http://localhost/img/logo.webp', srcset: '', width: 120, height: 40, alt: 'Rubaya' }

const config = () =>
  StoreConfigPublic.parse({
    brand: { name: 'Rubaya', logoLight: image },
    theme: themePresets['storefront-gold'],
    contact: { whatsapp: '923001234567', phone: '0300 1234567', email: 'hello@rubaya.pk', socials: [{ platform: 'Instagram', url: 'https://instagram.com/rubaya' }] },
    priceDisplay: { showDecimals: false, rounding: 'none' },
    locale: { default: 'en', supported: state.ur ? ['en', 'ur'] : ['en'] },
    features: { wishlist: true, reviews: true, notifyMe: true, customSizing: false },
    policies: { returnsDays: 7 },
    payments: [{ type: 'cod', label: 'Cash on delivery' }],
    shipping: { dispatchPromise: 'Dispatched within 2 days' },
    checkout: { extraFields: [], marketingConsent: { enabled: false, label: '' } },
    seo: {},
    environment: 'local',
  })

const money = (/** @type {number} */ amount) => ({ amount, currency: 'PKR' })
/** @param {number} n @param {object} [over] */
const product = (n, over = {}) => ({
  id: `0192f5aa-0000-7000-8000-0000000001${String(n).padStart(2, '0')}`, handle: `dress-${n}`, title: `Dress ${n}`, kind: 'stitched', primaryImage: { ...image, alt: `Dress ${n}` },
  priceFrom: money(699000), badges: [], stockStatus: 'in_stock', colorways: [], ...over,
})
const heroImage = { src: 'http://localhost/img/hero.webp', srcset: 'http://localhost/img/hero-480.webp 480w', width: 1600, height: 700, alt: 'Festive edit' }
const fullHome = {
  announcement: { text: 'Free delivery over Rs. 5,000' }, notices: [],
  heroSlides: [
    { id: 'h1', image: heroImage, heading: 'The Eid edit', subheading: 'Embroidered formals', buttonText: 'Shop now', buttonHref: '/new' },
    { id: 'h2', image: { ...heroImage, src: 'http://localhost/img/hero2.webp' }, heading: 'Summer lawn', buttonText: 'Evil button', buttonHref: 'javascript:alert(1)' },
  ],
  promo: { eyebrow: 'Sale', heading: 'Up to 25% off', text: 'Until Sunday', buttonText: 'See the sale', buttonHref: '/sale' },
  editorial: { heading: 'Made by hand', text: 'Our story', buttonText: 'Read more', buttonHref: '/pages/about' },
  footer: { about: 'Pakistani fashion.' },
}
const emptyHome = { notices: [], heroSlides: [], footer: {} }

const facets = [
  { key: 'size', label: 'Size', display: 'buttons', values: [{ value: 'M', label: 'M', count: 9, selected: false }, { value: 'L', label: 'L', count: 0, selected: false }] },
  { key: 'attr.fabric', label: 'Fabric', display: 'checkbox', values: Array.from({ length: 10 }, (_, i) => ({ value: `f${i}`, label: `Fabric ${i}`, count: 3, selected: false })) },
  { key: 'inStock', label: 'In stock', display: 'checkbox', values: [{ value: '1', label: 'In stock only', count: 20, selected: false }] },
]
/** The listing calls (a page of a category, the new arrivals, a search ...): 24 products and a next page, then 24 more; the home page asks for 8 and never for facets. @param {URLSearchParams} q */
function listing(q) {
  if (q.get('q') === 'nothing') return { items: [], total: 0 }
  const size = Number(q.get('limit'))
  const second = q.get('cursor') === 'c1'
  const items = Array.from({ length: Math.min(size, 24) }, (_, i) => product(i + (second ? 25 : 1)))
  if (size < 24) return { items, total: items.length }
  const selected = new Set((q.get('size') ?? '').split(','))
  return { items, total: 40, ...(second ? {} : { nextCursor: 'c1' }), facets: facets.map((f) => (f.key === 'size' ? { ...f, values: f.values.map((v) => ({ ...v, selected: selected.has(v.value) })) } : f)), pricePresets: [{ max: 500000 }, { min: 500000, max: 1000000 }, { min: 1000000 }] }
}

/** @param {string} p @param {string} locale @param {URLSearchParams} [q] */
function answer(p, locale, q = new URLSearchParams()) {
  if (p === '/api/v1/store/config') return config()
  if (p === '/api/v1/content/home') return locale === 'ur' ? emptyHome : fullHome
  if (p === '/api/v1/categories/lawn' || p === '/api/v1/categories/women') return { id: '0192f5aa-0000-7000-8000-000000000002', handle: p.slice(-5) === 'women' ? 'women' : 'lawn', name: 'Lawn', description: 'Light cotton for summer.', breadcrumb: [{ handle: 'women', name: 'Women' }, { handle: 'lawn', name: 'Lawn' }], children: [{ handle: 'printed', name: 'Printed' }], seo: { title: 'Lawn suits' } }
  if (p === '/api/v1/categories/old-lawn') return { redirectTo: 'lawn' }
  if (p === '/api/v1/collections/summer') return { id: '0192f5aa-0000-7000-8000-000000000201', handle: 'summer', title: 'Summer', seo: {} }
  if (p === '/api/v1/products' && q.get('size') === 'XXL') return { code: 'validation_failed', status: 400 }
  if (p === '/api/v1/products' && (q.get('limit') !== '8' || q.has('q'))) return listing(q)
  if (p === '/api/v1/products') {
    const n = locale === 'ur' ? 2 : 8
    const items = Array.from({ length: n }, (_, i) => product(i + 1, i === 0 ? { badges: ['sale'], priceFrom: money(600000), compareAtFrom: money(800000) } : i === 1 ? { badges: ['new', 'bestseller'] } : i === 2 ? { stockStatus: 'sold_out', badges: ['sold_out', 'sale'] } : {}))
    return { items, total: n }
  }
  if (p === '/api/v1/collections') return { items: [{ id: '0192f5aa-0000-7000-8000-000000000201', handle: 'summer', title: 'Summer', image }] }
  if (p === '/api/v1/content/menus/main') return { handle: 'main', items: [{ id: 'a', label: 'Women', href: '/c/women', children: [{ id: 'b', label: 'Lawn', href: '/c/lawn' }] }, { id: 'c', label: 'Evil', href: 'javascript:alert(1)' }] }
  if (p === '/api/v1/content/menus/footer') return { handle: 'footer', items: [{ id: 'f', label: 'Shipping', href: '/pages/shipping' }] }
  if (p === '/api/v1/categories') return { items: [{ id: '0192f5aa-0000-7000-8000-000000000001', handle: 'women', name: 'Women', productCount: 3, children: [{ id: '0192f5aa-0000-7000-8000-000000000002', handle: 'lawn', name: 'Lawn', productCount: 2, children: [] }] }] }
  if (p === '/api/v1/products/42') return { id: '42', handle: 'embroidered-lawn' }
  return undefined
}

const api = createServer((req, res) => {
  const u = new URL(req.url ?? '/', 'http://x')
  const body = state.down ? undefined : answer(u.pathname, u.searchParams.get('locale') ?? 'en', u.searchParams)
  res.statusCode = state.down ? 500 : body && 'status' in body ? Number(body.status) : body ? 200 : 404
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body ?? { code: 'not_found' }))
})

const listen = (/** @type {import('node:http').Server} */ s) => new Promise((resolve) => s.listen(0, '127.0.0.1', () => resolve(/** @type {import('node:net').AddressInfo} */ (s.address()).port)))
/** @type {import('node:child_process').ChildProcess} */
let server
let base = ''

/** @param {string} p @param {RequestInit} [init] */
const get = (p, init) => fetch(`${base}${p}`, { redirect: 'manual', ...init })

beforeAll(async () => {
  const apiPort = await listen(api)
  const env = { ...process.env, NODE_ENV: 'production', API_INTERNAL_URL: `http://127.0.0.1:${apiPort}`, PUBLIC_SITE_URL: 'http://localhost:5174', PUBLIC_IMG_URL: 'http://localhost/img' }
  execFileSync(process.execPath, [path.join(root, 'node_modules/@react-router/dev/bin.cjs'), 'build'], { cwd: root, env, stdio: 'pipe', timeout: 240_000 })
  // a free port for the storefront: ask the OS, then give it up
  const probe = createServer()
  const port = await listen(probe)
  await new Promise((resolve) => probe.close(resolve))
  base = `http://127.0.0.1:${port}`
  server = spawn(process.execPath, [path.join(root, 'node_modules/@react-router/serve/bin.cjs'), './build/server/index.js'], { cwd: root, env: { ...env, PORT: String(port) }, stdio: ['ignore', 'inherit', 'inherit'] })
  for (let i = 0; i < 60; i++) {
    try {
      if ((await get('/healthz')).ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('the storefront did not start')
}, 360_000)

afterAll(async () => {
  server?.kill()
  await new Promise((resolve) => api.close(resolve))
})

describe('the storefront through its whole stack', () => {
  it('a dead API gives a short 503 that is never cached, with a way to try again; the health check does not depend on the API', async () => {
    state.down = true
    const r = await get('/')
    expect(r.status).toBe(503)
    expect(r.headers.get('retry-after')).toBe('30')
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(await r.text()).toContain('Try again')
    expect((await get('/healthz')).status).toBe(200)
    state.down = false
  })

  const L = 'public, s-maxage=60, stale-while-revalidate=600'
  const S = 'public, s-maxage=3600, stale-while-revalidate=86400'
  const P = 'private, no-store'
  /** The URL map of DOC-06.1 section 2, with each address's cache class. */
  const table = /** @type {const} */ ([
    ['/', L], ['/c/women', L], ['/collections/summer', L], ['/new', L], ['/sale', L], ['/search?q=lawn', P], ['/p/embroidered-lawn', L], ['/cart', P], ['/checkout', P],
    ['/orders/sometoken', P], ['/orders/sometoken/review/line1', P], ['/track', P], ['/wishlist', P], ['/pages/about', S], ['/size-guide', S], ['/healthz', 'no-store'],
  ])

  it.each(table)('%s answers with its cache class', async (url, cache) => {
    const r = await get(url)
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toBe(cache)
  })

  it('an address nobody has is the shop\'s own 404 page, cached for a minute, with a way on', async () => {
    const r = await get('/no/such/page')
    expect(r.status).toBe(404)
    expect(r.headers.get('cache-control')).toBe('public, s-maxage=60')
    const html = await r.text()
    expect(html).toContain('role="search"')
    expect(html).toMatch(/href="\/new"/)
    expect(html).toMatch(/href="\/c\/women"/)
  })

  it('the home page holds nothing of a visitor: no cookie, no cart count', async () => {
    const r = await get('/')
    expect(r.headers.get('set-cookie')).toBeNull()
    const html = await r.text()
    expect(html).not.toMatch(/cart-count|data-count/)
    expect(html).toContain('Free delivery over Rs. 5,000')
  })

  it('the page works without JavaScript: skip link, main, navigation, search and cart links, and the footer are in the HTML', async () => {
    const html = await (await get('/')).text()
    expect(html).toMatch(/<a href="#main"[^>]*>Skip to main content<\/a>/)
    expect(html).toContain('<main id="main"')
    expect(html).toMatch(/<nav aria-label="Main"/)
    expect(html).toMatch(/href="\/c\/women"[^>]*>Women/)
    // a link with this address and this name, whatever order the attributes come in
    const link = (/** @type {string} */ href, /** @type {string} */ label) => new RegExp(`<a(?=[^>]*href="${href}")(?=[^>]*aria-label="${label}")[^>]*>`)
    expect(html).toMatch(link('/search', 'Search'))
    expect(html).toMatch(link('/cart', 'Cart'))
    expect(html).toMatch(link('/wishlist', 'Wishlist'))
    expect(html).toContain('href="/pages/shipping"')
    expect(html).toContain('https://wa.me/923001234567')
    expect(html).not.toContain('javascript:alert') // a menu address that is not safe never reaches the page
  })

  it('the theme is one inline style, and the CSP allows exactly that block by its hash', async () => {
    const r = await get('/')
    const html = await r.text()
    const style = /<style>([^<]*--sem-bg[^<]*)<\/style>/.exec(html)?.[1]
    expect(style).toBeTruthy()
    const hash = createHash('sha256').update(/** @type {string} */ (style).replaceAll('&amp;', '&')).digest('base64')
    const csp = r.headers.get('content-security-policy') ?? ''
    expect(csp).toContain(`style-src 'self' 'sha256-${hash}'`)
    expect(csp).not.toMatch(/style-src[^;]*unsafe-inline/)
  })

  it('order pages are never sent with a referrer', async () => {
    expect((await get('/orders/sometoken')).headers.get('referrer-policy')).toBe('no-referrer')
  })

  describe('the home page (DOC-06.2)', () => {
    it('English: one h1 from the first slide, its picture the only one loaded eagerly, the sections in their order, no frame without content', async () => {
      const r = await get('/')
      const html = await r.text()
      expect(html.match(/<h1/g)).toHaveLength(1)
      expect(html).toMatch(/<h1[^>]*>The Eid edit</)
      // React writes the attribute as fetchPriority; the browser reads it either way. The preload link it adds for that picture is what the plan asks for too.
      expect(html.match(/<img[^>]*fetchPriority="high"/g)).toHaveLength(1) // the first hero picture: the largest element of the page
      expect(html).toMatch(/<img(?=[^>]*fetchPriority="high")(?=[^>]*hero\.webp)[^>]*>/)
      expect(html).toMatch(/<link rel="preload" as="image"[^>]*hero/)
      expect(html).not.toMatch(/<img(?=[^>]*loading="eager")(?![^>]*fetchPriority="high")[^>]*>/) // nothing else is eager: the cards are below the fold
      // the bestsellers are below the fold and stream in after the rest: React puts them at the end of the document and moves them into place, so they are checked apart
      expect(html).toContain('Bestsellers')
      const order = ['The Eid edit', 'New arrivals', 'Up to 25% off', 'Made by hand', 'Collections'].map((t) => html.indexOf(t))
      expect(order.every((at) => at > 0)).toBe(true)
      expect([...order].sort((a, b) => a - b)).toEqual(order)
      expect(html).toContain('href="/p/dress-1"')
      expect(html).toContain('-25%') // the sale badge: 6,000 off 8,000
      expect(html).toContain('Sold out')
      expect(html.match(/<article/g)).toHaveLength(16) // new arrivals and bestsellers, eight each
      expect(html).toContain('href="/collections/summer"')
    })

    it('a hero button whose address is javascript: draws no button at all', async () => {
      const html = await (await get('/')).text()
      expect(html).toContain('Summer lawn')
      expect(html).not.toContain('Evil button')
      expect(html).not.toContain('javascript:')
      expect(html).toContain('Shop now') // the safe one is there
    })
  })

  describe('the listings (DOC-06.3)', () => {
    it('a category: 24 titles and prices in the HTML, the way up, subcategories, filters in a real form, and the way to more', async () => {
      const r = await get('/c/lawn')
      expect(r.status).toBe(200)
      expect(r.headers.get('cache-control')).toBe('public, s-maxage=60, stale-while-revalidate=600')
      const html = await r.text()
      expect(html.match(/<h1/g)).toHaveLength(1)
      expect(html).toMatch(/<h1[^>]*>Lawn</)
      expect(html).toContain('<title>Lawn suits | Rubaya</title>')
      expect(html.match(/<article/g)).toHaveLength(24)
      expect(html).toContain('Dress 24')
      expect(html).toContain('6,990')
      expect(html).toContain('href="/c/women"') // the way up; the current page is not a link
      expect(html).toContain('href="/c/printed"')
      // React writes the attributes in an order of its own, so each is looked for apart
      expect(html).toMatch(/<form(?=[^>]*method="get")(?=[^>]*action="\/c\/lawn")[^>]*>/)
      expect(html).toContain('name="size"')
      expect(html).toContain('Apply filters') // without JavaScript the filters are sent with a button
      expect(html).toMatch(/<input(?=[^>]*name="size")(?=[^>]*value="L")(?=[^>]*disabled)[^>]*>/) // nobody can pick it, so it is greyed out, not removed
      expect(html).toContain('Show all') // more than eight fabrics
      expect(html).toContain('href="/c/lawn?cursor=c1"') // load more is a real link
      expect(html).toContain('Showing 24 of 40')
      expect(html).toMatch(/role="status"[^>]*>40 products/)
      expect(html).toContain('Under ') // the price ranges
      expect(html).toContain('/c/lawn?priceMax=500000')
    })

    it('an address in any other form is sent to its canonical one; values the API refuses and old handles are sent on; a missing category is a 404', async () => {
      const a = await get('/c/lawn?sort=newest&size=M&size=L&utm_source=x')
      expect(a.status).toBe(301)
      expect(a.headers.get('location')).toBe('/c/lawn?size=L,M&sort=newest')
      expect((await get('/c/lawn?size=L,M&sort=newest')).status).toBe(200)
      expect((await get('/c/lawn?size=L%2CM&sort=newest')).status).toBe(200) // the same address with the comma escaped, as a navigation in the browser writes it: no bounce
      const b = await get('/c/lawn?size=XXL')
      expect(b.status).toBe(302)
      expect(b.headers.get('location')).toBe('/c/lawn')
      const c = await get('/c/old-lawn?size=M')
      expect(c.status).toBe(301)
      expect(c.headers.get('location')).toBe('/c/lawn?size=M')
      expect((await get('/c/nothing-here')).status).toBe(404)
    })

    it('a chosen filter is checked and shows as a chip that takes it off; the page behind a cursor shows its own items', async () => {
      const html = await (await get('/c/lawn?size=M')).text()
      expect(html).toMatch(/<input(?=[^>]*name="size")(?=[^>]*value="M")(?=[^>]*checked)[^>]*>/)
      expect(html).toContain('aria-label="Remove filter M"')
      expect(html).toContain('Clear all')
      const next = await (await get('/c/lawn?cursor=c1')).text()
      expect(next).toContain('Dress 25')
      expect(next).not.toContain('Dress 1<')
      expect(next).not.toContain('cursor=c1"') // no further page
    })

    it('new, sale, a collection and a search have their own heading and breadcrumb; a search is never cached and is not for the index', async () => {
      for (const { p, h1 } of [{ p: '/new', h1: 'New arrivals' }, { p: '/sale', h1: 'Sale' }, { p: '/collections/summer', h1: 'Summer' }]) {
        const r = await get(p)
        expect(r.status, p).toBe(200)
        expect(r.headers.get('cache-control')).toContain('public')
        expect(await r.text(), p).toMatch(new RegExp(`<h1[^>]*>${h1}<`))
      }
      const r = await get('/search?q=shalwar')
      expect(r.headers.get('cache-control')).toBe('private, no-store')
      const html = await r.text()
      expect(html).toMatch(/<h1[^>]*>Results for “shalwar”</)
      expect(html).toContain('content="noindex,follow"')
      expect(html).toContain('Most relevant')
    })

    it('a search text is escaped, and short or empty ones ask nothing of the API', async () => {
      const html = await (await get('/search?q=%3Cscript%3Ealert(1)%3C/script%3E', { redirect: 'follow' })).text()
      expect(html).not.toContain('<script>alert(1)')
      expect(html).toContain('&lt;script&gt;')
      const short = await (await get('/search?q=a')).text()
      expect(short).toContain('Type at least 2 letters')
      expect(short).toContain('href="/c/women"') // the categories to start from
      expect(short).not.toMatch(/<article/)
    })

    it('a search with no results says so, with the new pieces and WhatsApp', async () => {
      const html = await (await get('/search?q=nothing')).text()
      expect(html).toContain('No results for “nothing”')
      expect(html).toContain('https://wa.me/923001234567?text=nothing')
      expect(html.match(/<article/g)).toHaveLength(4)
    })
  })

  describe('redirects of the old shop (section 4)', () => {
    const cases = /** @type {const} */ ([
      ['/shop', '/new'], ['/shop?tag=new', '/new'], ['/shop?tag=sale', '/sale'], ['/shop?q=red', '/search?q=red'], ['/shop?category=Women', '/c/women'], ['/shop?category=Women&sub=Lawn', '/c/lawn'],
      ['/shop?category=Kids', '/search?q=Kids'], ['/product/42', '/p/embroidered-lawn'], ['/track-order', '/track'], ['/order-confirmation/9', '/track'], ['/pages/size-guide', '/size-guide'],
      ['/C/Women/', '/c/women'], ['/new/?sort=newest', '/new?sort=newest'],
    ])
    it.each(cases)('%s goes to %s with a 301', async (from, to) => {
      const r = await get(from)
      expect(r.status).toBe(301)
      expect(r.headers.get('location')).toBe(to)
    })

    it('an old product id that is not a product is a 404', async () => {
      expect((await get('/product/999')).status).toBe(404)
    })
  })

  describe('the language prefix (plan/03 section 8)', () => {
    it('/ur is not a page while Urdu is off, and /en is never one', async () => {
      state.ur = false
      for (const p of ['/ur', '/ur/new', '/en', '/fr/new']) expect((await get(p)).status, p).toBe(404)
    })

    it('with Urdu on, /ur answers in Urdu, right to left, and its links stay in Urdu', async () => {
      state.ur = true
      await new Promise((r) => setTimeout(r, 31_000)) // the shell is kept for 30 seconds
      const r = await get('/ur')
      expect(r.status).toBe(200)
      const html = await r.text()
      expect(html).toMatch(/<html lang="ur" dir="rtl"/)
      expect(html).toMatch(/href="\/ur\/c\/women"/)
      expect(html).toContain('href="/"') // the way back to English
      // nothing to show but two products: no hero, no empty frame, one h1 (the shop's name, kept for screen readers), no product section under four
      expect(html.match(/<h1/g)).toHaveLength(1)
      expect(html).toMatch(/<h1 class="sr-only">Rubaya</)
      expect(html).not.toMatch(/<article/)
      expect(html).not.toMatch(/fetchPriority/)
      // a listing in Urdu: its links stay in Urdu
      const list = await (await get('/ur/c/lawn')).text()
      expect(list).toContain('href="/ur/c/printed"')
      expect(list).toContain('href="/ur/c/lawn?cursor=c1"')
      expect(list).toContain('پروڈکٹس')
      state.ur = false
    }, 60_000)
  })
})
