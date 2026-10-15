// M5-01: the rules of the shell that need no server: where old and untidy addresses go (DOC-06.1 section 4), the one form of a listing's query (section 5),
// the menu a visitor sees, the language switch, and the security header for the theme block.
import { describe, expect, it } from 'vitest'
import { switchLocalePath } from '../app/features/layout/shell'
import { footerColumns, navItems, safeItems } from '../app/lib/nav'
import { normalizeOrderNumber } from '../app/lib/order-number'
import { localePath } from '../app/lib/paths'
import { canonicalQuery, redirectFor } from '../app/lib/redirects'
import { securityHeaders } from '../app/lib/security.server'

const url = (/** @type {string} */ p) => new URL(`https://rubaya.pk${p}`)
const tree = [
  { handle: 'women', name: 'Women', children: [{ handle: 'lawn', name: 'Lawn', children: [] }] },
  { handle: 'men', name: 'Men', children: [] },
]

describe('redirects of the old shop (DOC-06.1 section 4)', () => {
  it('sends the old shop pages to the new ones', () => {
    expect(redirectFor(url('/shop'))).toEqual({ to: '/new' })
    expect(redirectFor(url('/shop?tag=new'))).toEqual({ to: '/new' })
    expect(redirectFor(url('/shop?tag=sale'))).toEqual({ to: '/sale' })
    expect(redirectFor(url('/shop?q=red%20dupatta'))).toEqual({ to: '/search?q=red%20dupatta' })
    expect(redirectFor(url('/track-order'))).toEqual({ to: '/track' })
    expect(redirectFor(url('/order-confirmation/12345'))).toEqual({ to: '/track' })
    expect(redirectFor(url('/pages/size-guide'))).toEqual({ to: '/size-guide' })
  })

  it('finds a category by its old name, a subcategory first, and falls back to a search for one that is unknown', () => {
    expect(redirectFor(url('/shop?category=Women'), tree)).toEqual({ to: '/c/women' })
    expect(redirectFor(url('/shop?category=women&sub=LAWN'), tree)).toEqual({ to: '/c/lawn' })
    expect(redirectFor(url('/shop?category=Women&sub=Bridal'), tree)).toEqual({ to: '/c/women' })
    expect(redirectFor(url('/shop?category=Kids'), tree)).toEqual({ to: '/search?q=Kids' })
  })

  it('asks for the product behind an old id', () => {
    expect(redirectFor(url('/product/42'))).toEqual({ productId: '42' })
    expect(redirectFor(url('/product/42/'))).toEqual({ productId: '42' })
  })

  it('lower-cases, drops the trailing slash and keeps the query; a clean address is left alone', () => {
    expect(redirectFor(url('/C/Lawn/'))).toEqual({ to: '/c/lawn' })
    expect(redirectFor(url('/new/?sort=price_asc'))).toEqual({ to: '/new?sort=price_asc' })
    expect(redirectFor(url('/ur/c/Lawn'))).toEqual({ to: '/ur/c/lawn' })
    for (const ok of ['/', '/new', '/c/lawn', '/p/embroidered-lawn', '/ur', '/ur/new', '/cart']) expect(redirectFor(url(ok)), ok).toBeUndefined()
  })

  it('an order\'s link is a token: its case is never touched, only a slash at its end', () => {
    expect(redirectFor(url('/orders/2_xKORnlRUlw'))).toBeUndefined()
    expect(redirectFor(url('/ur/orders/2_xKORnlRUlw'))).toBeUndefined()
    expect(redirectFor(url('/orders/2_xKORnlRUlw/'))).toEqual({ to: '/orders/2_xKORnlRUlw' })
  })

  it('a data request of the router is the same address: the redirect never has `.data` in it (it would be added again)', () => {
    expect(redirectFor(url('/C/Lawn.data'))).toEqual({ to: '/c/lawn' })
    expect(redirectFor(url('/new.data'))).toBeUndefined()
  })
})

describe('the canonical query (DOC-06.1 section 5)', () => {
  it('keeps the known parameters, alphabetical, with their values sorted; drops the rest', () => {
    const q = (/** @type {string} */ s) => canonicalQuery(new URLSearchParams(s))
    expect(q('sort=newest&size=M,L&utm_source=ad&fbclid=1&color=red')).toBe('?color=red&size=L,M&sort=newest')
    expect(q('size=M&size=L')).toBe('?size=L,M')
    expect(q('attr.fabric=silk,cotton&kind=stitched')).toBe('?attr.fabric=cotton,silk&kind=stitched')
    expect(q('utm_source=ad&gclid=1')).toBe('')
    expect(q('')).toBe('')
    expect(q('sort=')).toBe('')
  })

  it('is the same for every order of the same parameters, so it is a cache key', () => {
    const a = canonicalQuery(new URLSearchParams('size=M&sort=newest&color=red'))
    const b = canonicalQuery(new URLSearchParams('color=red&sort=newest&size=M'))
    expect(a).toBe(b)
    expect(canonicalQuery(new URLSearchParams(a.slice(1)))).toBe(a)
  })
})

describe('the navigation (DOC-06.13 section 4)', () => {
  const labels = { new: 'New in', sale: 'Sale', collections: 'Collections' }
  const cats = [
    { id: 'c1', handle: 'women', name: 'Women', children: [{ id: 'c3', handle: 'stitched', name: 'Stitched', children: [] }, { id: 'c4', handle: 'unstitched', name: 'Unstitched', children: [] }] },
    { id: 'c2', handle: 'men', name: 'Men', children: [] },
  ]
  const cols = [{ id: 'k1', handle: 'new-in', title: 'New in' }, { id: 'k2', handle: 'eid-edit', title: 'Eid edit' }, { id: 'k3', handle: 'sale', title: 'Sale' }]
  const base = { locale: /** @type {const} */ ('en'), mode: /** @type {const} */ ('automatic'), menu: [], categories: cats, collections: cols, labels }

  it('is made from the categories and collections: New in, each top category with its sub-categories, Collections, Sale', () => {
    const items = navItems(base)
    expect(items.map((i) => [i.label, i.href])).toEqual([['New in', '/new'], ['Women', '/c/women'], ['Men', '/c/men'], ['Collections', '/collections'], ['Sale', '/sale']])
    expect(items[1]?.children?.map((c) => c.href)).toEqual(['/c/stitched', '/c/unstitched'])
    // New in and Sale are pages of their own; only the other featured collections go under Collections
    expect(items[3]?.children?.map((c) => [c.label, c.href])).toEqual([['Eid edit', '/collections/eid-edit']])
  })

  it('has no Collections item when there is no featured collection, and follows the language', () => {
    expect(navItems({ ...base, collections: [{ id: 'k1', handle: 'new-in', title: 'New in' }] }).map((i) => i.id)).toEqual(['new', 'c1', 'c2', 'sale'])
    expect(navItems({ ...base, locale: 'ur' })[1]?.href).toBe('/ur/c/women')
  })

  it('keeps every category the API gave it, so a category the API left out (no products) is not in the bar', () => {
    expect(navItems({ ...base, categories: cats.slice(1) }).map((i) => i.label)).toEqual(['New in', 'Men', 'Collections', 'Sale'])
  })

  it('uses the menu staff wrote only in custom mode, in the language of the page', () => {
    const menu = [{ id: 'a', label: 'Women', href: '/c/women', children: [{ id: 'b', label: 'Lawn', href: '/c/lawn' }] }, { id: 'e', label: 'Journal', href: 'https://blog.example.com' }]
    expect(navItems({ ...base, locale: 'ur', mode: 'custom', menu })).toEqual([
      { id: 'a', label: 'Women', href: '/ur/c/women', children: [{ id: 'b', label: 'Lawn', href: '/ur/c/lawn' }] },
      { id: 'e', label: 'Journal', href: 'https://blog.example.com' },
    ])
    // automatic mode ignores the written menu (the seed used to write a two-item one)
    expect(navItems({ ...base, menu }).map((i) => i.id)).toEqual(['new', 'c1', 'c2', 'collections', 'sale'])
  })

  it('leaves out an item whose address is not safe, and its children', () => {
    const menu = [{ id: 'x', label: 'Bad', href: 'javascript:alert(1)', children: [{ id: 'y', label: 'Child', href: '/new' }] }, { id: 'ok', label: 'Fine', href: '/new' }]
    expect(safeItems('en', menu).map((i) => i.id)).toEqual(['ok'])
  })

  it('falls back to the automatic bar when the custom menu is empty or all unsafe', () => {
    const allBad = [{ id: 'x', label: 'Bad', href: 'javascript:alert(1)' }]
    expect(navItems({ ...base, mode: 'custom', menu: allBad, categories: [], collections: [] }).map((i) => i.href)).toEqual(['/new', '/sale'])
    expect(navItems({ ...base, mode: 'custom' }).map((i) => i.id)).toContain('c1')
  })
})

describe('the footer columns (DOC-06.13 section 7)', () => {
  const labels = { new: 'New in', sale: 'Sale', allCategories: 'All categories', allCollections: 'All collections', trackOrder: 'Track order', sizeGuide: 'Size guide' }
  const pages = [
    { id: 'p1', label: 'Shipping and returns', href: '/pages/shipping-returns' },
    { id: 'p2', label: 'Privacy policy', href: '/pages/privacy' },
    { id: 'p3', label: 'Contact us', href: '/pages/contact' },
    { id: 'p4', label: 'About us', href: '/pages/about' },
  ]
  const categories = [{ id: 'c1', handle: 'women', name: 'Women', children: [] }]
  const cols = footerColumns({ locale: 'en', categories, collections: [{ id: 'k1', handle: 'eid-edit', title: 'Eid edit' }], pages, labels })

  it('puts the categories, New in, Sale and All categories under Shop', () => {
    expect(cols.shop.map((i) => i.href)).toEqual(['/new', '/c/women', '/sale', '/categories'])
  })

  it('splits the pages into Help (with Track order and the size guide) and Company', () => {
    expect(cols.help.map((i) => i.href)).toEqual(['/track', '/pages/shipping-returns', '/pages/contact', '/size-guide'])
    expect(cols.company.map((i) => i.href)).toEqual(['/pages/privacy', '/pages/about'])
  })

  it('lists the featured collections and All collections, and no column when there are none', () => {
    expect(cols.collections.map((i) => i.href)).toEqual(['/collections/eid-edit', '/collections'])
    expect(footerColumns({ locale: 'en', categories, collections: [], pages, labels }).collections).toEqual([])
  })

  it('follows the language', () => {
    expect(footerColumns({ locale: 'ur', categories, collections: [], pages: [], labels }).help[0]?.href).toBe('/ur/track')
  })
})

describe('paths and languages (plan/03 section 8)', () => {
  it('puts /ur in front for Urdu and nothing for English', () => {
    expect(localePath('en', '/c/lawn')).toBe('/c/lawn')
    expect(localePath('ur', '/c/lawn')).toBe('/ur/c/lawn')
    expect(localePath('ur', '/')).toBe('/ur')
  })

  it('switches a page to the other language, keeping the query', () => {
    expect(switchLocalePath('/c/lawn', '?sort=newest', 'ur')).toBe('/ur/c/lawn?sort=newest')
    expect(switchLocalePath('/ur/c/lawn', '?sort=newest', 'en')).toBe('/c/lawn?sort=newest')
    expect(switchLocalePath('/', '', 'ur')).toBe('/ur')
    expect(switchLocalePath('/ur', '', 'en')).toBe('/')
    expect(switchLocalePath('/ur/', '', 'en')).toBe('/')
  })
})

describe('the CSP of a page with a theme (plan/04-design-system/tokens.md section 6)', () => {
  const opts = { nonce: 'abc', imgOrigin: 'https://img.rubaya.pk', production: true, path: '/' }
  it('allows the one inline style by its hash and no other inline style', () => {
    const csp = securityHeaders({ ...opts, themeHash: 'HASH123=' })['Content-Security-Policy'] ?? ''
    expect(csp).toContain("style-src 'self' 'sha256-HASH123='")
    expect(csp).not.toMatch(/style-src[^;]*nonce/)
    expect(csp).not.toMatch(/(^|; )style-src [^;]*unsafe-inline/)
    expect(csp).toContain("style-src-attr 'unsafe-inline'") // attributes only: see security.server.js
  })
  it('allows no inline style when there is no theme block', () => {
    expect(securityHeaders(opts)['Content-Security-Policy']).toContain("style-src 'self';")
  })
})

describe('the order number a customer types (DOC-06.6 section 3)', () => {
  it('becomes RB-<digits> whether it is the digits alone, in any case, with spaces, or with the old prefix', () => {
    for (const typed of ['RB-10458', 'rb-10458', 'RB 10458', ' 10458 ', 'nc-10458', 'NC 10458', 'rb10458']) expect(normalizeOrderNumber(typed), typed).toBe('RB-10458')
  })
  it('anything else is left as typed, in capitals, for the API to say it does not know it', () => {
    expect(normalizeOrderNumber('abc')).toBe('ABC')
    expect(normalizeOrderNumber('XY-12')).toBe('XY-12')
    expect(normalizeOrderNumber('')).toBe('')
  })
})
