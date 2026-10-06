// M5-01: the rules of the shell that need no server: where old and untidy addresses go (DOC-06.1 section 4), the one form of a listing's query (section 5),
// the menu a visitor sees, the language switch, and the security header for the theme block.
import { describe, expect, it } from 'vitest'
import { switchLocalePath } from '../app/features/layout/shell'
import { navItems, safeItems } from '../app/lib/nav'
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

describe('the navigation (DOC-06.1 section 3)', () => {
  const labels = { new: 'New', sale: 'Sale' }
  const cats = [{ id: 'c1', handle: 'women', name: 'Women' }, { id: 'c2', handle: 'men', name: 'Men' }]

  it('uses the menu the shop set up, in the visitor\'s language', () => {
    const menu = [{ id: 'a', label: 'Women', href: '/c/women', children: [{ id: 'b', label: 'Lawn', href: '/c/lawn' }] }, { id: 'e', label: 'Journal', href: 'https://blog.example.com' }]
    expect(navItems({ locale: 'ur', menu, categories: cats, labels })).toEqual([
      { id: 'a', label: 'Women', href: '/ur/c/women', children: [{ id: 'b', label: 'Lawn', href: '/ur/c/lawn' }] },
      { id: 'e', label: 'Journal', href: 'https://blog.example.com' },
    ])
  })

  it('leaves out an item whose address is not safe, and its children', () => {
    const menu = [{ id: 'x', label: 'Bad', href: 'javascript:alert(1)', children: [{ id: 'y', label: 'Child', href: '/new' }] }, { id: 'ok', label: 'Fine', href: '/new' }]
    expect(safeItems('en', menu).map((i) => i.id)).toEqual(['ok'])
  })

  it('falls back to New, the top categories and Sale when there is no menu', () => {
    expect(navItems({ locale: 'en', menu: [], categories: cats, labels }).map((i) => [i.label, i.href])).toEqual([['New', '/new'], ['Women', '/c/women'], ['Men', '/c/men'], ['Sale', '/sale']])
    const allBad = [{ id: 'x', label: 'Bad', href: 'javascript:alert(1)' }]
    expect(navItems({ locale: 'en', menu: allBad, categories: [], labels }).map((i) => i.href)).toEqual(['/new', '/sale'])
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
    expect(csp).not.toMatch(/style-src[^;]*unsafe-inline/)
  })
  it('allows no inline style when there is no theme block', () => {
    expect(securityHeaders(opts)['Content-Security-Policy']).toContain("style-src 'self';")
  })
})
