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
const state = /** @type {{ down: boolean, ur: boolean, wishlist: boolean, cartBody: any, calls: string[], blocked: boolean, order: any }} */ ({ down: false, ur: false, wishlist: true, cartBody: undefined, calls: [], blocked: false, order: undefined })
const image = { src: 'http://localhost/img/logo.webp', srcset: '', width: 120, height: 40, alt: 'Rubaya' }

const config = () =>
  StoreConfigPublic.parse({
    brand: { name: 'Rubaya', logoLight: image },
    theme: themePresets['storefront-gold'],
    contact: { whatsapp: '923001234567', phone: '0300 1234567', email: 'hello@rubaya.pk', socials: [{ platform: 'Instagram', url: 'https://instagram.com/rubaya' }] },
    priceDisplay: { showDecimals: false, rounding: 'none' },
    locale: { default: 'en', supported: state.ur ? ['en', 'ur'] : ['en'] },
    features: { wishlist: state.wishlist, reviews: true, notifyMe: true, customSizing: false },
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
  // a lookup by ids (the wishlist): the ones the shop has, in the order asked; any other id is a product that is no longer for sale
  if (q.has('ids')) {
    const items = (q.get('ids') ?? '').split(',').flatMap((id) => { const n = Number(id.slice(-3)) - 100; return id.startsWith('0192f5aa-0000-7000-8000-0000000001') && n >= 1 && n <= 9 ? [product(n)] : [] })
    return { items, total: items.length }
  }
  if (q.get('q') === 'nothing') return { items: [], total: 0 }
  const size = Number(q.get('limit'))
  const second = q.get('cursor') === 'c1'
  const items = Array.from({ length: Math.min(size, 24) }, (_, i) => product(i + (second ? 25 : 1)))
  if (size < 24) return { items, total: items.length }
  const selected = new Set((q.get('size') ?? '').split(','))
  return { items, total: 40, ...(second ? {} : { nextCursor: 'c1' }), facets: facets.map((f) => (f.key === 'size' ? { ...f, values: f.values.map((v) => ({ ...v, selected: selected.has(v.value) })) } : f)), pricePresets: [{ max: 500000 }, { min: 500000, max: 1000000 }, { min: 1000000 }] }
}

const uuid = (/** @type {number} */ n) => `0192f5aa-0000-7000-8000-${String(n).padStart(12, '0')}`
/** A stitched dress in three sizes: S has two left, M is sold out, L is plentiful. */
const detail = () => ({
  id: uuid(100), handle: 'dress-1', kind: 'stitched', status: 'active', title: 'Dress 1', subtitle: 'Embroidered lawn', brand: 'Rubaya', descriptionMd: 'Soft **lawn** with care.', highlights: ['Three piece'], care: ['Dry clean only'],
  breadcrumb: [{ handle: 'women', name: 'Women' }, { handle: 'lawn', name: 'Lawn' }],
  media: [1, 2, 3].map((n) => ({ ...image, alt: n === 1 ? 'Front' : '', id: uuid(300 + n), kind: 'image', src: `http://localhost/img/p${n}.webp` })),
  options: [{ id: uuid(10), name: 'Size', role: 'size', display: 'buttons', values: [{ id: uuid(11), label: 'S', kind: 'standard' }, { id: uuid(12), label: 'M', kind: 'standard' }, { id: uuid(13), label: 'L', kind: 'standard' }] }],
  variants: [
    { id: uuid(21), sku: 'D-S', optionValueIds: [uuid(11)], price: money(699000), compareAt: money(849000), stockStatus: 'low_stock', available: 2, maxPerOrder: 10 },
    { id: uuid(22), sku: 'D-M', optionValueIds: [uuid(12)], price: money(699000), stockStatus: 'sold_out', maxPerOrder: 10 },
    { id: uuid(23), sku: 'D-L', optionValueIds: [uuid(13)], price: money(749000), stockStatus: 'in_stock', maxPerOrder: 10 },
  ],
  components: [{ type: 'shirt', label: 'Shirt', fabric: 'Lawn', quantity: '3 m', included: true }], attributes: [{ label: 'Fabric', values: ['Lawn'] }],
  siblings: [{ handle: 'dress-1', label: 'Teal', swatch: { hex: ['#008080'] }, image, current: true }, { handle: 'dress-2', label: 'Rose', swatch: { hex: ['#ff6699'] }, image, current: false }],
  colorway: { label: 'Teal', family: 'blue', swatch: { hex: ['#008080'] } },
  sizeChartId: uuid(40), fit: { note: 'runs_small', modelHeightCm: 168, modelWears: 'M' }, badges: [], rating: { average: 4.6, count: 38 },
  delivery: { etaMinDays: 3, etaMaxDays: 5, codAvailable: true, freeAbove: money(500000) }, seo: { title: 'Embroidered lawn 3-piece' }, updatedAt: '2026-10-01T00:00:00.000Z',
})

const one = (/** @type {string} */ handle, /** @type {string} */ kind, /** @type {object} */ over) => ({
  ...detail(), id: uuid(600 + handle.length), handle, kind, title: handle, options: [], variants: [{ id: uuid(700 + handle.length), sku: handle, optionValueIds: [], price: money(500000), stockStatus: 'in_stock', maxPerOrder: 10 }], sizeChartId: undefined, fit: undefined, components: [], ...over,
})
const sizeOption = { id: uuid(50), name: 'Size', role: 'size', display: 'buttons', values: [{ id: uuid(51), label: '40', kind: 'standard' }, { id: uuid(52), label: '41', kind: 'standard' }] }
/** One product of each of the other kinds (DOC-06.4 section 5). @param {string} handle */
const ofKind = (handle) => (/** @type {Record<string, () => object>} */ ({
  'unstitched-1': () => one(handle, 'unstitched', { components: [{ type: 'shirt', label: 'Shirt', fabric: 'Lawn', quantity: '3 m', included: true }, { type: 'dupatta', label: 'Dupatta', fabric: 'Chiffon', quantity: '2.5 m', included: true }] }),
  'mto-1': () => one(handle, 'made_to_order', {
    options: [{ ...sizeOption, values: [...sizeOption.values, { id: uuid(53), label: 'Custom size', kind: 'custom' }] }], customSizeSchemaId: uuid(60),
    variants: [uuid(51), uuid(52), uuid(53)].map((v, i) => ({ id: uuid(710 + i), sku: `m${i}`, optionValueIds: [v], price: money(18500000), stockStatus: 'made_to_order', maxPerOrder: 10 })),
    madeToOrder: { leadMinDays: 15, leadMaxDays: 20, label: 'Made for you in 15–20 days', returnable: false, depositPercent: 30 },
  }),
  'shoe-1': () => one(handle, 'footwear', { options: [sizeOption], variants: [uuid(51), uuid(52)].map((v, i) => ({ id: uuid(720 + i), sku: `s${i}`, optionValueIds: [v], price: money(500000), stockStatus: 'in_stock', maxPerOrder: 10 })), sizeChartId: uuid(40) }),
  'bundle-1': () => one(handle, 'bundle', { bundle: { items: [{ product: product(5), options: [sizeOption], variants: [uuid(51), uuid(52)].map((v, i) => ({ id: uuid(730 + i), sku: `b${i}`, optionValueIds: [v], price: money(300000), stockStatus: 'in_stock', maxPerOrder: 10 })) }] } }),
  'accessory-1': () => one(handle, 'accessory', {}),
}))[handle]?.()

/** A cart with one line of two dresses; the API has worked every figure out. */
const cartOf = () => ({
  lines: [{
    id: uuid(800), productId: uuid(100), variantId: uuid(23), handle: 'dress-1', title: 'Dress 1', variantLabel: 'L', kind: 'stitched', quantity: 2, unitPrice: money(749000), lineSubtotal: money(1498000), lineDiscount: money(0),
    available: 5, maxPerOrder: 10, issues: state.blocked ? ['sold_out'] : ['price_changed'], customization: { measurements: { bust: 36 }, summary: 'Custom: bust 36 in' },
  }],
  count: 2, subtotal: money(1498000), discount: money(100000), total: money(1398000), promo: { code: 'SAVE10', label: '10% off', discount: money(100000) },
  messages: [{ code: 'free_shipping_remaining', amount: money(250000) }], depositDue: money(420000), hasBlockingIssues: state.blocked,
})

const cities = [
  { id: uuid(901), name: 'Sukkur', province: 'Sindh', aliases: [], isMajor: false },
  { id: uuid(902), name: 'Lahore', province: 'Punjab', aliases: [], isMajor: true },
  { id: uuid(903), name: 'Karachi', province: 'Sindh', aliases: [], isMajor: true },
]
const method = { methodId: uuid(910), label: 'Standard delivery', fee: money(25000), etaMinDays: 3, etaMaxDays: 5, codAllowed: true }
/** The cart as the API prices it for a city: shipping, total, the zone's methods, the allowed payments. */
const quoted = () => ({ ...cartOf(), shipping: { methodId: method.methodId, label: method.label, fee: method.fee, etaMinDays: 3, etaMaxDays: 5 }, shippingOptions: [method], paymentOptions: [{ method: 'cod', label: 'Cash on delivery', allowed: true }], total: money(1423000) })

const step = (/** @type {string} */ name, /** @type {string | undefined} */ at, current = false) => ({ step: name, ...(at ? { at } : {}), current })
/** An order of one customer as the API masks it, in each state of section 4.2 of DOC-06.6. @param {string} status @param {object} [over] */
const orderOf = (status, over = {}) => ({
  orderNumber: 'RB-10458', status, placedAt: '2026-10-02T10:45:00.000Z',
  timeline: [step('placed', '2026-10-02T10:45:00.000Z', status === 'pending' || status === 'pending_confirmation'), step('confirmed', ['confirmed', 'dispatched', 'delivered'].includes(status) ? '2026-10-02T12:00:00.000Z' : undefined, status === 'confirmed'), step('dispatched', ['dispatched', 'delivered'].includes(status) ? '2026-10-03T09:00:00.000Z' : undefined, status === 'dispatched'), step('delivered', status === 'delivered' ? '2026-10-05T09:00:00.000Z' : undefined, status === 'delivered')],
  lines: [{ id: uuid(850), title: 'Lawn 3-Piece', variantLabel: 'M', quantity: 1, unitPrice: money(699000), lineTotal: money(699000), ...(status === 'delivered' ? { review: { available: true, submitted: false } } : {}) }],
  subtotal: money(699000), discount: money(0), shippingFee: money(25000), total: money(724000), paid: money(0), dueOnDelivery: money(724000),
  paymentMethod: 'cod', paymentLabel: 'Cash on delivery', paymentStatus: 'unpaid',
  customer: { firstName: 'Ayesha', phoneMasked: '0300 ••••567' },
  delivery: { city: 'Lahore', addressMasked: 'House 12, Str•••', methodLabel: 'Standard delivery', ...(status === 'dispatched' ? { courier: 'TCS', trackingNumber: 'T123', trackingUrl: 'https://tcs.example/t/T123' } : {}) },
  allowedActions: status === 'pending' || status === 'pending_confirmation' ? ['cancel'] : [], locale: 'en',
  ...(status === 'cancelled' ? { closed: { status: 'cancelled', at: '2026-10-03T09:00:00.000Z', reason: 'customer_request' } } : {}),
  ...over,
})
const orderStates = ['pending', 'pending_confirmation', 'confirmed', 'dispatched', 'delivered', 'cancelled']

/** The pages of the shop as the API gives them: the text already has the shop's numbers in it. A slug it does not know is a draft or nothing: 404. @param {string} slug @param {string} locale */
const pageOf = (slug, locale) => {
  const base = { slug, seo: {}, updatedAt: '2026-10-01T00:00:00.000Z', locale: locale === 'ur' ? 'en' : locale }
  if (slug === 'contact') return { ...base, title: 'Contact us', bodyMd: 'Call 0300 1234567 or write to hello@rubaya.pk.' }
  if (slug === 'old-contact') return { redirectTo: 'contact' }
  if (slug === 'hostile') {
    return { ...base, title: 'Hostile', seo: { title: 'Hostile page', description: 'A test' }, bodyMd: [
      '# Big heading', '', 'Fine text with **bold**.', '', '<script>alert(1)</script>', '', '[x](javascript:alert(1))', '', '![x](https://evil.example/a.png "10x10")', '',
      '![shop](http://localhost/img/ok.png "800x1000")', '', '| a | b |', '|---|---|', '| 1 | 2 |', '', '[wa](https://wa.me/923001234567)',
    ].join('\n') }
  }
  if (slug === 'about' || slug === 'shipping-returns' || slug === 'privacy' || slug === 'terms') return { ...base, title: slug, bodyMd: 'Words.' }
  return undefined
}

/** @param {string} p @param {string} locale @param {URLSearchParams} [q] @param {{ method?: string, body?: any, headers?: import('node:http').IncomingHttpHeaders }} [req] */
function answer(p, locale, q = new URLSearchParams(), req = {}) {
  const kind = ofKind(p.replace('/api/v1/products/', ''))
  if (kind) return kind
  if (p === '/api/v1/form-schemas/' + uuid(60)) return { id: uuid(60), fields: [{ key: 'bust', label: 'Bust', type: 'number', required: true, min: 20, max: 60, unit: 'in' }, { key: 'length', label: 'Length', type: 'number', required: false, unit: 'in' }], allowNotes: true }
  if (p === '/api/v1/products/dress-1' || p === '/api/v1/products/embroidered-lawn') return detail()
  if (p === '/api/v1/products/old-dress') return { redirectTo: 'dress-1' }
  if (p === '/api/v1/size-charts/' + uuid(40)) return { id: uuid(40), title: 'Women', unit: 'in', tables: [{ id: 't', title: 'Body', columns: ['Bust', 'Waist'], rows: [{ label: 'S', values: [34, 28] }] }] }
  if (p === '/api/v1/products/' + uuid(100) + '/reviews') return { items: [{ id: uuid(500), displayName: 'Sana', rating: 5, body: 'Lovely fit', photos: [], createdAt: '2026-09-01T00:00:00.000Z' }], summary: { average: 4.6, count: 38, byStar: [1, 1, 2, 9, 25] } }
  if (p === '/api/v1/products/' + uuid(100) + '/related') return { items: [product(7), product(8), product(9), product(10)] }
  if (p === '/api/v1/orders/track') {
    state.calls.push(`TRACK ${JSON.stringify(req.body)}`)
    if (req.body.orderNumber === 'RB-10458' && req.body.phone === '+923001234567') return { trackingToken: 'Tok_pending_Abc' }
    return req.body.orderNumber === 'RB-429' ? { title: 'Slow', status: 429, code: 'rate_limited' } : { title: 'No order', status: 404, code: 'order_not_found' }
  }
  const byToken = /^\/api\/v1\/orders\/by-token\/Tok_([a-z_]+)_Abc(\/.*)?$/.exec(p)
  if (byToken) {
    const status = byToken[1] ?? ''
    const rest = byToken[2] ?? ''
    if (!orderStates.includes(status)) return undefined
    if (rest === '') return orderOf(status)
    if (rest === '/cancel') { state.calls.push('CANCEL'); return orderOf('cancelled') }
    if (rest === '/switch-to-cod') { state.calls.push('SWITCH'); return orderOf('pending_confirmation') }
    if (rest === `/lines/${uuid(850)}/review` && req.method === 'GET') return { product: { title: 'Lawn 3-Piece' }, displayNameDefault: 'Ayesha K.', sized: true, submitted: false }
    if (rest === `/lines/${uuid(850)}/review` && req.method === 'POST') { state.calls.push(`REVIEW ${JSON.stringify(req.body)}`); return { status: 'pending' } }
  }
  const page = /^\/api\/v1\/content\/pages\/([a-z-]+)$/.exec(p)
  if (page) return pageOf(page[1] ?? '', locale)
  if (p === '/api/v1/size-charts') return { items: [{ id: uuid(40), title: 'Women', unit: 'in', notes: 'Measure over light clothes.', tables: [{ id: 't', title: 'Body', columns: ['S', 'M'], rows: [{ label: 'Bust', values: [34, 36] }] }] }] }
  if (p === '/api/v1/shipping/cities') return { items: cities }
  if (p === '/api/v1/cart/quote') return req.body.cityId === uuid(999) ? { title: 'No zone', status: 422, code: 'city_not_served' } : quoted()
  if (p === '/api/v1/orders' && req.method === 'POST') {
    state.order = { key: req.headers?.['idempotency-key'], token: req.headers?.['x-cart-token'], body: req.body }
    if (req.body.customer.name === 'Changed') return { title: 'Changed', status: 409, code: 'price_changed', cart: { ...quoted(), total: money(1500000) } }
    if (req.body.customer.name === 'Busy') return { title: 'Slow down', status: 429, code: 'rate_limited' }
    if (req.body.customer.name === 'Down') return { title: 'Boom', status: 500, code: 'internal_error' }
    return { orderNumber: 'RB-10001', trackingToken: 'Tok_En-Abc', status: 'pending', total: money(1423000) }
  }
  if (p.startsWith('/api/v1/cart') && p !== '/api/v1/cart/lines') {
    state.calls.push(`${req.method} ${p} ${JSON.stringify(req.body ?? '')}`)
    if (p === '/api/v1/cart/promo' && req.method === 'PUT') {
      if (req.body.code === 'BIG') return { title: 'Minimum', status: 422, code: 'promo_min_spend', minSpend: money(500000) }
      if (req.body.code === 'NOPE') return { title: 'Unknown', status: 422, code: 'promo_not_found' }
    }
    if (p.startsWith('/api/v1/cart/lines/') && req.method === 'PUT' && req.body.quantity > 5) return { title: 'Not enough', status: 409, code: 'insufficient_stock', available: 5 }
    if (!req.headers?.['x-cart-token']) return { title: 'No cart', status: 404, code: 'not_found' }
    return req.method === 'GET' && q.get('summary') ? { count: 2 } : cartOf()
  }
  if (p === '/api/v1/cart/lines' && req.method === 'POST') {
    state.cartBody = req.body
    if (req.body.quantity > 2) return { title: 'Not enough stock', status: 409, code: 'insufficient_stock', available: 2 }
    return { cartToken: 'tok-123', lines: [], count: req.body.quantity, subtotal: money(0), discount: money(0), total: money(0), messages: [], hasBlockingIssues: false }
  }
  if (p === '/api/v1/vitals') { state.calls.push('VITALS ' + JSON.stringify(req.body)); return { status: 204 } }
  if (p === '/api/v1/sitemap-entries') return { items: [{ loc: '/', lastmod: '2026-10-01T00:00:00.000Z', type: 'home' }, { loc: '/p/dress-1', lastmod: '2026-10-02T00:00:00.000Z', image: 'http://localhost/img/p1.webp', type: 'product' }] }
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

const api = createServer(async (req, res) => {
  const u = new URL(req.url ?? '/', 'http://x')
  let text = ''
  for await (const chunk of req) text += chunk
  /** @type {any} */
  const body = state.down ? undefined : answer(u.pathname, u.searchParams.get('locale') ?? 'en', u.searchParams, { method: req.method ?? 'GET', body: text ? JSON.parse(text) : undefined, headers: req.headers })
  res.statusCode = state.down ? 500 : body && typeof body.status === 'number' ? body.status : body ? 200 : 404
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
    ['/orders/Tok_pending_confirmation_Abc', P], ['/orders/Tok_delivered_Abc/review/0192f5aa-0000-7000-8000-000000000850', P], ['/track', P], ['/wishlist', P], ['/pages/about', S], ['/size-guide', S], ['/healthz', 'no-store'],
  ])

  // the checkout is for a visitor with something in the cart: without it, it sends them to the cart
  it.each(table)('%s answers with its cache class', async (url, cache) => {
    const r = await get(url, { headers: { cookie: 'nc_cart=tok-123' } })
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toBe(cache)
    // a response that a cache may keep sets no cookie (plan/06-storefront/07-account-wishlist.md section 4)
    if (cache.startsWith('public')) expect(r.headers.get('set-cookie'), url).toBeNull()
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
    expect(csp).not.toMatch(/(^|; )style-src [^;]*unsafe-inline/)
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
      // the router's own data request for the same page: the redirect has no `.data` in it either (the router adds it itself)
      const data = await (await get('/c/lawn.data?size=M&size=L')).text()
      expect(data).toContain('/c/lawn?size=L,M')
      expect(data).not.toContain('lawn.data')
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

  describe('the product page (DOC-06.4)', () => {
    it('server HTML: heading, the price, the options, a form that posts to the cart, the way up, the sections, one cache class', async () => {
      const r = await get('/p/dress-1')
      expect(r.status).toBe(200)
      expect(r.headers.get('cache-control')).toBe('public, s-maxage=60, stale-while-revalidate=600')
      const html = await r.text()
      expect(html.match(/<h1/g)).toHaveLength(1)
      expect(html).toMatch(/<h1[^>]*>Dress 1</)
      expect(html).toContain('<title>Embroidered lawn 3-piece | Rubaya</title>')
      expect(html).toMatch(/<form(?=[^>]*action="\/cart")(?=[^>]*method="post")[^>]*>/)
      expect(html).toContain('From') // nothing is chosen, the sizes differ in price: the lowest
      expect(html).toMatch(/<input(?=[^>]*type="radio")(?=[^>]*name="opt\.[^"]*")[^>]*>/)
      expect(html).not.toMatch(/<input(?=[^>]*type="radio")(?=[^>]*checked)[^>]*>/) // no size is chosen for the visitor
      expect(html).toMatch(/<input(?=[^>]*type="radio")(?=[^>]*aria-disabled="true")[^>]*>/) // M is sold out: marked, still there
      expect(html).toContain('Select Size')
      expect(html).toContain('href="/c/lawn"')
      expect(html).toContain('Runs small: consider one size up')
      expect(html).toContain('Model is 168 cm and wears M')
      expect(html).toContain('Dry clean only')
      expect(html).toContain('<strong>lawn</strong>') // the description is Markdown
      expect(html).toContain('href="/p/dress-2"') // the other colour is its own page
      expect(html).toContain('4.6 out of 5')
      expect(html).toContain('wa.me/923001234567')
      expect(html).toContain('Cash on delivery available')
      expect(html.match(/<img[^>]*fetchPriority="high"/g)).toHaveLength(1) // the first picture only
      expect(html).toContain('Front') // a picture's own words
      expect(html).toContain('Dress 1, picture 2') // and, with none, the title and its place
    })

    it('every kind shows its own blocks (DOC-06.4 section 5)', async () => {
      const page = async (/** @type {string} */ handle) => await (await get(`/p/${handle}`)).text()
      const unstitched = await page('unstitched-1')
      expect(unstitched).toContain('What is included')
      expect(unstitched).toContain('Dupatta')
      expect(unstitched).toContain('Fabric only, stitching not included.')
      expect(unstitched).toContain('Add to cart') // one variant: nothing to choose first
      expect(unstitched).not.toContain('Select ')
      const mto = await page('mto-1')
      expect(mto).toContain('Made for you in 15–20 days')
      expect(mto).toContain('A deposit of 30% starts your order.')
      expect(mto).toContain('Made-to-order pieces cannot be returned.')
      expect(mto).toContain('Custom size') // the made-to-measure value of the size
      expect(mto).toContain('Select Size')
      const shoe = await page('shoe-1')
      expect(shoe).toContain('Select Size')
      const bundle = await page('bundle-1')
      expect(bundle).toContain('In this set')
      expect(bundle).toContain('Select a size for Dress 5') // every part of the set needs its size
      const accessory = await page('accessory-1')
      expect(accessory).toContain('Add to cart')
      expect(accessory).not.toContain('What is included') // no components
    })

    it('an old handle is sent on, a missing product is a 404', async () => {
      const r = await get('/p/old-dress')
      expect(r.status).toBe(301)
      expect(r.headers.get('location')).toBe('/p/dress-1')
      expect((await get('/p/nothing-here')).status).toBe(404)
    })

    it('the reviews and related products are in the page after they stream in; a size in the address is chosen', async () => {
      const html = await (await get('/p/dress-1?size=l', { headers: { 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' } })).text()
      expect(html).toContain('Lovely fit')
      expect(html).toContain('You may also like')
      expect(html).toMatch(/<input(?=[^>]*type="radio")(?=[^>]*checked)[^>]*>/)
    })

    it('adding without JavaScript: the variant is found from the options, no price is sent, the cart cookie is set, the visitor goes to the cart', async () => {
      const body = new URLSearchParams({ intent: 'add', handle: 'dress-1', quantity: '1', [`opt.${uuid(10)}`]: uuid(13) })
      const r = await get('/cart', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } })
      expect(r.status).toBe(302)
      expect(r.headers.get('location')).toBe('/cart')
      expect(state.cartBody).toEqual({ variantId: uuid(23), quantity: 1 })
      expect(r.headers.get('set-cookie')).toMatch(/^nc_cart=tok-123; Path=\/; Max-Age=2592000; HttpOnly; SameSite=Lax/)
    })

    it('measurements, a note and the chosen parts of a set go on the line as the customer gave them, and empty answers are left out', async () => {
      const body = new URLSearchParams({ intent: 'add', variantId: uuid(23), quantity: '1', 'm.bust': ' 36 ', 'm.waist': '', notes: 'Longer sleeves', [`bundle.${uuid(7)}`]: uuid(24) })
      await get('/cart', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } })
      expect(state.cartBody).toEqual({ variantId: uuid(23), quantity: 1, customization: { measurements: { bust: '36' }, notes: 'Longer sleeves', bundle: [{ productId: uuid(7), variantId: uuid(24) }] } })
    })

    it('adding more than there is: nothing is added, the visitor is sent back with the reason and the number left', async () => {
      const body = new URLSearchParams({ intent: 'add', variantId: uuid(21), handle: 'dress-1', quantity: '3', returnTo: '/p/dress-1' })
      const r = await get('/cart', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } })
      expect(r.headers.get('location')).toBe('/p/dress-1?cartError=insufficient_stock&n=2')
      expect(r.headers.get('set-cookie')).toBeNull()
      const page = await (await get('/p/dress-1?cartError=insufficient_stock&n=2')).text()
      expect(page).toContain('Only 2 available.')
    })

    it('a made-up choice is refused, a page of another site cannot add to the cart, and the return address is only ever a product page', async () => {
      const post = (/** @type {Record<string, string>} */ fields, /** @type {Record<string, string>} */ headers = {}) => get('/cart', { method: 'POST', body: new URLSearchParams(fields), headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers } })
      const none = await post({ intent: 'add', handle: 'dress-1', quantity: '1', returnTo: '/p/dress-1' }) // no size chosen
      expect(none.headers.get('location')).toBe('/p/dress-1?cartError=invalid')
      expect((await post({ intent: 'add', variantId: uuid(23), quantity: '1' }, { origin: 'https://evil.example' })).status).toBe(400) // React Router's own origin check: the cart was not touched
      const away = await post({ intent: 'add', handle: 'dress-1', quantity: '1', returnTo: 'https://evil.example/' })
      expect(away.headers.get('location')).toBe('/cart?error=invalid')
      expect((await post({ intent: 'checkout' })).status).toBe(400)
    })
  })

  describe('the cart (DOC-06.5 sections 2 and 3)', () => {
    const withCart = { cookie: 'nc_cart=tok-123' }
    const plain = (/** @type {string} */ t) => t.replace(/\u00a0/g, ' ')
    const post = (/** @type {Record<string, string>} */ fields) => get('/cart', { method: 'POST', body: new URLSearchParams(fields), headers: { 'content-type': 'application/x-www-form-urlencoded', ...withCart } })

    it('the page is the visitor\'s own: never cached, never indexed; with no cart it says so and offers a way on', async () => {
      const r = await get('/cart')
      expect(r.headers.get('cache-control')).toBe('private, no-store')
      const html = await r.text().then(plain)
      expect(html).toContain('Your cart is empty')
      expect(html).toContain('href="/new"')
      expect(html).toContain('content="noindex,nofollow"')
    })

    it('a cart shows what the API worked out, as it came: lines, issues, promo, shipping progress, deposit, total, the way to checkout', async () => {
      const html = await (await get('/cart', { headers: withCart })).text().then(plain)
      expect(html).toContain('Dress 1')
      expect(html).toContain('Custom: bust 36 in')
      expect(html).toContain('Price updated to Rs 7,490') // the line's issue
      expect(html).toContain('Rs 14,980') // the line total, as returned
      expect(html).toContain('Rs 13,980') // the total, as returned
      expect(html).toContain('SAVE10')
      expect(html).toContain('Add Rs 2,500 more for free delivery')
      expect(html).toContain('deposit of Rs 4,200')
      expect(html).toContain('Calculated at checkout')
      expect(html).toMatch(/<a(?=[^>]*href="\/checkout")[^>]*>Checkout/)
      expect(html).toMatch(/<form(?=[^>]*action="\/cart")[^>]*>/)
      expect(html).toMatch(/<input(?=[^>]*name="quantity")(?=[^>]*type="number")[^>]*>/) // without JavaScript a number and an Update button
      expect(html).toContain('Update')
    })

    it('a sold-out line stops the way to checkout and says why', async () => {
      state.blocked = true
      const html = await (await get('/cart', { headers: withCart })).text().then(plain)
      state.blocked = false
      expect(html).toContain('Sold out: remove to continue')
      expect(html).toContain('Remove the sold-out items to continue.')
      expect(html).not.toMatch(/<a(?=[^>]*href="\/checkout")[^>]*>Checkout/)
      expect(html).toMatch(/<button(?=[^>]*disabled)[^>]*>Checkout/)
    })

    it('without JavaScript every action goes to the API once and the visitor comes back to the cart', async () => {
      state.calls = []
      for (const fields of /** @type {Record<string, string>[]} */ ([{ intent: 'setQty', lineId: uuid(800), quantity: '3' }, { intent: 'remove', lineId: uuid(800) }, { intent: 'applyPromo', code: 'save10' }, { intent: 'removePromo' }])) {
        const r = await post(fields)
        expect(r.status, JSON.stringify(fields)).toBe(302)
        expect(r.headers.get('location')).toBe('/cart')
      }
      expect(state.calls).toEqual([
        `PUT /api/v1/cart/lines/${uuid(800)} {"quantity":3}`,
        `DELETE /api/v1/cart/lines/${uuid(800)} ""`,
        'PUT /api/v1/cart/promo {"code":"SAVE10"}', // the code is the API's to read; the client only tidies its case
        'DELETE /api/v1/cart/promo ""',
      ])
    })

    it('what goes wrong is said: more than there is, a code that is unknown, a code with a minimum spend', async () => {
      const more = await post({ intent: 'setQty', lineId: uuid(800), quantity: '9' })
      expect(more.headers.get('location')).toBe('/cart?error=insufficient_stock&n=5')
      expect(await (await get('/cart?error=insufficient_stock&n=5', { headers: withCart })).text().then(plain)).toContain('Only 5 available.')
      const unknown = await post({ intent: 'applyPromo', code: 'NOPE' })
      expect(unknown.headers.get('location')).toBe('/cart?error=promo_not_found')
      expect(await (await get('/cart?error=promo_not_found', { headers: withCart })).text().then(plain)).toContain('We do not know this code.')
      const min = await post({ intent: 'applyPromo', code: 'BIG' })
      expect(min.headers.get('location')).toBe('/cart?error=promo_min_spend&amount=500000')
      expect(await (await get('/cart?error=promo_min_spend&amount=500000', { headers: withCart })).text().then(plain)).toContain('Spend at least Rs 5,000 to use this code.')
      expect((await post({ intent: 'setQty', lineId: uuid(800), quantity: '-1' })).headers.get('location')).toBe('/cart?error=invalid')
    })

    it('the header asks for the number in the cart after the page has loaded, so a cached page holds nothing of a visitor', async () => {
      const html = await (await get('/')).text().then(plain)
      expect(html).toMatch(/<a(?=[^>]*href="\/cart")[^>]*aria-label="Cart"[^>]*>/)
      expect(html).not.toContain('Cart, ')
    })
  })

  describe('the checkout (DOC-06.5 section 4)', () => {
    const withCart = { cookie: 'nc_cart=tok-123' }
    const form = { 'content-type': 'application/x-www-form-urlencoded' }
    const plain = (/** @type {string} */ t) => t.replace(/\u00a0/g, ' ')
    const post = (/** @type {Record<string, string>} */ fields, /** @type {Record<string, string>} */ extra = {}) => get('/checkout', { method: 'POST', body: new URLSearchParams(fields), headers: { ...form, ...withCart, ...extra } })
    const good = { intent: 'place', name: 'Sana Ali', phone: '0300 1234567', cityId: uuid(902), address: 'House 12, Street 4, Gulberg III', shippingMethodId: uuid(910), paymentMethod: 'cod', idempotencyKey: uuid(777), expectedTotal: '1423000' }

    it('an empty cart goes back to the cart', async () => {
      const r = await get('/checkout')
      expect(r.status).toBe(302)
      expect(r.headers.get('location')).toBe('/cart')
    })

    it('the page: its own slim header and no footer, never cached, the cities (the big ones first), cash on delivery chosen, a key for this checkout, the way to the terms', async () => {
      const r = await get('/checkout', { headers: withCart })
      expect(r.headers.get('cache-control')).toBe('private, no-store')
      const html = plain(await r.text())
      expect(html).toContain('content="noindex,nofollow"')
      expect(html).toContain('Back to cart')
      expect(html).not.toContain('<footer')
      expect(html).not.toContain('wa.me') // no chat button over the form
      expect(html.indexOf('>Karachi<')).toBeGreaterThan(0)
      expect(html.indexOf('>Karachi<')).toBeLessThan(html.indexOf('>Lahore<') + 100)
      expect(html.indexOf('>Lahore<')).toBeLessThan(html.indexOf('>Sukkur<'))
      expect(html).toMatch(/<input(?=[^>]*name="paymentMethod")(?=[^>]*value="cod")(?=[^>]*checked)[^>]*>/)
      expect(html).toMatch(/<input(?=[^>]*name="idempotencyKey")(?=[^>]*value="[0-9a-f-]{36}")[^>]*>/)
      expect(html).toMatch(/<input(?=[^>]*name="expectedTotal")(?=[^>]*value="1398000")[^>]*>/)
      expect(html).toContain('Show delivery options') // without JavaScript the city is sent with a button
      expect(html).toContain('href="/pages/terms"')
      expect(html).toContain('We will contact you on WhatsApp or by phone to confirm your order')
      // Enter must place the order: the first button of the form is the one that places it
      expect(html.slice(html.indexOf('<form'), html.indexOf('Show delivery options'))).toMatch(/name="intent"[^>]*value="place"|value="place"[^>]*name="intent"/)
    })

    it('without JavaScript the delivery options come from the server for the chosen city, and what was typed stays', async () => {
      const r = await post({ intent: 'quote', name: 'Sana', cityId: uuid(902), paymentMethod: 'cod' })
      const html = plain(await r.text())
      expect(r.status).toBe(200)
      expect(html).toContain('Standard delivery')
      expect(html).toContain('3 to 5 days')
      expect(html).toContain('Rs 14,230') // the total, as the API worked it out
      expect(html).toMatch(/<input(?=[^>]*name="name")(?=[^>]*value="Sana")[^>]*>/)
      expect(html).toMatch(new RegExp(`<option(?=[^>]*value="${uuid(902)}")(?=[^>]*selected)[^>]*>`))
    })

    it('a city outside every zone has no delivery method, the page says so with the WhatsApp link, and an order for it is not placed', async () => {
      const html = plain(await (await post({ intent: 'quote', cityId: uuid(999), paymentMethod: 'cod' })).text())
      expect(html).toContain('We do not deliver to this city yet.')
      expect(html).toContain('wa.me/923001234567')
      expect(html).not.toMatch(/<input(?=[^>]*type="radio")(?=[^>]*name="shippingMethodId")[^>]*>/)
      state.order = undefined
      const placed = plain(await (await post({ ...good, cityId: uuid(999), shippingMethodId: '' })).text())
      expect(state.order).toBeUndefined()
      expect(placed).toContain('Please choose a delivery method.')
    })

    it('every phone way of writing goes to the API as +923001234567, and the order carries no price, no discount and no fee, only the total that was shown', async () => {
      for (const phone of ['0300 1234567', '3001234567', '+92 300 1234567']) {
        state.order = undefined
        const r = await post({ ...good, phone })
        expect(r.status, phone).toBe(302)
        expect(state.order.body.customer.phone, phone).toBe('+923001234567')
      }
      expect(state.order.key).toBe(uuid(777)) // the key of this checkout, on every call
      expect(state.order.token).toBe('tok-123') // the cart token, from the cookie
      expect(Object.keys(state.order.body).sort()).toEqual(['customer', 'expectedTotal', 'locale', 'paymentMethod', 'shippingAddress', 'shippingMethodId'])
      expect(state.order.body.expectedTotal).toEqual(money(1423000))
    })

    it('a placed order leaves for its page, and the cart is forgotten', async () => {
      const r = await post(good)
      expect(r.status).toBe(302)
      expect(r.headers.get('location')).toBe('/orders/Tok_En-Abc?placed=1') // the token keeps its case
      expect(r.headers.get('set-cookie')).toMatch(/^nc_cart=; Path=\/; Max-Age=0; HttpOnly/)
    })

    it('a landline, a short address and the like are refused where they are, with what was typed kept, and nothing is sent to the API', async () => {
      state.order = undefined
      const r = await post({ ...good, phone: '051 1234567', address: 'short', email: 'nope' })
      const html = plain(await r.text())
      expect(r.status).toBe(200)
      expect(state.order).toBeUndefined()
      expect(html).toContain('Please enter a Pakistani mobile number')
      expect(html).toContain('Please enter your full address')
      expect(html).toContain('Please enter a valid email address.')
      expect(html).toMatch(/<input(?=[^>]*name="name")(?=[^>]*value="Sana Ali")[^>]*>/)
    })

    it('when the price moved: the page stays, lists what changed, shows the new total, keeps the fields, and the next try has a new key', async () => {
      const r = await post({ ...good, name: 'Changed' })
      const html = plain(await r.text())
      expect(r.status).toBe(200)
      expect(html).toContain('Something changed while you were checking out.')
      expect(html).toContain('Rs 15,000') // the new total
      expect(html).toMatch(/<input(?=[^>]*name="name")(?=[^>]*value="Changed")[^>]*>/)
      const next = /name="idempotencyKey"[^>]*value="([^"]+)"|value="([^"]+)"[^>]*name="idempotencyKey"/.exec(html)
      expect(next?.[1] ?? next?.[2]).not.toBe(uuid(777))
    })

    it('too many tries, and an order that cannot be confirmed, are said plainly', async () => {
      expect(plain(await (await post({ ...good, name: 'Busy' })).text())).toContain('Too many attempts. Please wait a minute and try again.')
      const html = plain(await (await post({ ...good, name: 'Down' })).text())
      expect(html).toContain('We could not confirm your order. Please try again: you will not be charged twice.')
    })

    it('a made-up form is refused', async () => {
      expect((await post({ intent: 'nope' })).status).toBe(400)
    })
  })

  describe('the pages of staff and the size guide (DOC-06.8)', () => {
    it('a page: one heading, the shop\'s contact details drawn from its settings, a cache that may keep it, and no cookie', async () => {
      const r = await get('/pages/contact')
      expect(r.status).toBe(200)
      expect(r.headers.get('cache-control')).toBe('public, s-maxage=3600, stale-while-revalidate=86400')
      expect(r.headers.get('set-cookie')).toBeNull()
      const html = await r.text()
      expect(html.match(/<h1/g)).toHaveLength(1)
      expect(html).toContain('Call 0300 1234567')
      const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'))
      expect(main).toContain('href="tel:03001234567"')
      expect(main).toContain('href="mailto:hello@rubaya.pk"')
      expect(main).toContain('href="https://wa.me/923001234567"')
      expect(html).toContain('<title>Contact us | Rubaya</title>')
    })

    it('what a page body holds is drawn as text and elements only: no script, no unsafe link, no picture from another site, the first heading is not a second h1', async () => {
      const html = await (await get('/pages/hostile')).text()
      const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'))
      expect(main).not.toContain('alert(1)')
      expect(main.replace(/<script type="application\/ld\+json">[^<]*<\/script>/g, '')).not.toContain('<script') // the page's own data is the only script
      expect(main).not.toContain('javascript:')
      expect(main).not.toContain('evil.example')
      expect(html.match(/<h1/g)).toHaveLength(1)
      expect(main).toMatch(/<h2[^>]*>Big heading</)
      expect(main).toContain('<strong>bold</strong>')
      expect(main).toContain('src="http://localhost/img/ok.png"') // a picture of the shop's own image host
      expect(main).toMatch(/<table/)
      expect(main).toMatch(/<th[^>]*scope="col"/)
      expect(main).toContain('href="https://wa.me/923001234567"')
      expect(html).toContain('<title>Hostile page | Rubaya</title>')
    })

    it('an old address goes to the page, and a page that is not active is a 404', async () => {
      const r = await get('/pages/old-contact')
      expect(r.status).toBe(301)
      expect(r.headers.get('location')).toBe('/pages/contact')
      expect((await get('/pages/draft')).status).toBe(404)
    })

    it('the size guide: every chart with its tables in both units without JavaScript, readable header cells, the way to measure, linked from the footer', async () => {
      const html = await (await get('/size-guide')).text()
      expect(html.match(/<h1/g)).toHaveLength(1)
      expect(html).toContain('Women')
      expect(html).toContain('Body (in)')
      expect(html).toContain('Body (cm)') // the other unit is in the page too
      expect(html).toContain('86.4') // 34 in, worked out
      expect(html).toMatch(/<th[^>]*scope="col"/)
      expect(html).toMatch(/<th[^>]*scope="row"/)
      expect(html).toContain('Measure over light clothes.')
      expect(html).toContain('href="/size-guide"') // the footer's link
    })
  })

  describe('the wishlist (DOC-06.7)', () => {
    const id = (/** @type {number} */ n) => `0192f5aa-0000-7000-8000-0000000001${String(n).padStart(2, '0')}`
    const saved = (/** @type {string} */ value) => ({ cookie: `nc_wishlist=${encodeURIComponent(value)}` })

    it('the page lists the saved products in the order they were saved, and is the visitor\'s own', async () => {
      const r = await get('/wishlist', { headers: saved([id(2), id(1)].join(',')) })
      expect(r.status).toBe(200)
      expect(r.headers.get('cache-control')).toBe('private, no-store')
      expect(r.headers.get('x-robots-tag')).toContain('noindex')
      expect(r.headers.get('set-cookie')).toBeNull() // nothing to tidy
      const html = await r.text()
      expect(html).toMatch(/<h1[^>]*>Wishlist \(2\)</)
      expect(html.indexOf('Dress 2')).toBeGreaterThan(0)
      expect(html.indexOf('Dress 2')).toBeLessThan(html.indexOf('Dress 1<'))
      expect(html).toContain('View product')
    })

    it('a product that is no longer sold, text that is not an id and a repeat are left out, and the cookie is written again without them', async () => {
      const r = await get('/wishlist', { headers: saved([id(1), 'garbage', id(59), id(1), id(3)].join(',')) })
      const html = await r.text()
      expect((html.match(/<article/g) ?? []).length).toBe(2)
      expect(r.headers.get('set-cookie')).toMatch(new RegExp(`^nc_wishlist=${encodeURIComponent(`${id(1)},${id(3)}`)}; Path=/; Max-Age=31536000; SameSite=Lax`))
      expect(r.headers.get('set-cookie')).not.toMatch(/HttpOnly/) // the browser changes it itself
    })

    it('a cookie of three hundred ids or only rubbish is cut or ignored without an error; with nothing saved the page says so and sets nothing', async () => {
      const many = Array.from({ length: 300 }, (_, i) => `0192f5aa-0000-7000-8000-${String(i + 1000).padStart(12, '0')}`).join(',')
      expect((await get('/wishlist', { headers: saved(many) })).status).toBe(200)
      const rubbish = await get('/wishlist', { headers: saved('<script>,,;;,12') })
      expect(rubbish.status).toBe(200)
      expect(await rubbish.text()).toContain('Nothing saved yet')
      const none = await get('/wishlist')
      expect(await none.text()).toContain('Nothing saved yet')
      expect(none.headers.get('set-cookie')).toBeNull()
    })

    it('a page that a cache may keep draws every heart unpressed, whatever the visitor has saved', async () => {
      const html = await (await get('/c/lawn', { headers: saved(id(1)) })).text()
      expect(html).toMatch(/<button(?=[^>]*aria-pressed="false")(?=[^>]*aria-label="Save Dress 1")[^>]*>/)
      expect(html).not.toContain('aria-pressed="true"')
    })
  })

  describe('the order page and the lookup (DOC-06.6)', () => {
    const plain = (/** @type {string} */ t) => t.replace(/\u00a0/g, ' ')
    const form = { 'content-type': 'application/x-www-form-urlencoded' }

    it('the page is the customer\'s own: never cached, not indexed, sent with no referrer; the masked values are all there is of the person', async () => {
      const r = await get('/orders/Tok_pending_confirmation_Abc')
      expect(r.status).toBe(200)
      expect(r.headers.get('cache-control')).toBe('private, no-store')
      expect(r.headers.get('x-robots-tag')).toContain('noindex')
      expect(r.headers.get('referrer-policy')).toBe('no-referrer')
      const html = plain(await r.text())
      expect(html).toContain('0300 ••••567')
      expect(html).toContain('House 12, Str•••')
      expect(html).toContain('Ayesha')
      // no full number anywhere in what the order shows (the footer carries the shop's own number, which is another thing)
      const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'))
      expect(main).not.toMatch(/0300 ?1234567|03001234567|\+92300/)
      expect(html).toContain('Rs 7,240') // the total as the API wrote it
    })

    it('each state has its own words: the next step, the timeline with the current step marked, the actions the API allows', async () => {
      const page = async (/** @type {string} */ status) => plain(await (await get(`/orders/Tok_${status}_Abc`)).text())
      const pending = await page('pending')
      expect(pending).toContain('Complete your payment to confirm this order.')
      const confirming = await page('pending_confirmation')
      expect(confirming).toContain('We will call or WhatsApp you on 0300 ••••567 to confirm your order.')
      expect(confirming).toMatch(/<li[^>]*aria-current="step"[^>]*>/)
      expect(confirming).toContain('Cancel order') // offered because the API lists it
      expect(await page('confirmed')).toContain('Your order is being prepared.')
      expect(await page('confirmed')).not.toContain('Cancel order')
      expect(await page('confirmed')).toContain('Need to cancel? WhatsApp us')
      const dispatched = await page('dispatched')
      expect(dispatched).toContain('On its way with TCS.')
      expect(dispatched).toContain('Tracking no. T123')
      expect(dispatched).toContain('href="https://tcs.example/t/T123"')
      expect(dispatched).toContain('Please keep Rs 7,240 ready.')
      const delivered = await page('delivered')
      expect(delivered).toContain('Delivered on')
      expect(delivered).toContain('Write a review')
      expect(delivered).toContain(`href="/orders/Tok_delivered_Abc/review/${uuid(850)}"`)
      const cancelled = await page('cancelled')
      expect(cancelled).toContain('This order was cancelled on')
      expect(cancelled).toContain('Cancelled at your request.')
      expect(cancelled).not.toMatch(/<ol[^>]*aria-label="Order progress"/) // the timeline gives way to the banner
    })

    it('the thank-you variant of the same page, and a token no order has is a 404', async () => {
      const html = plain(await (await get('/orders/Tok_pending_confirmation_Abc?placed=1')).text())
      expect(html).toMatch(/<h1[^>]*>Thank you, Ayesha!</)
      expect(html).toContain('wa.me/923001234567?text=Hi%2C%20this%20is%20about%20my%20order%20RB-10458.') // only the number of the order goes in the message
      expect((await get('/orders/Tok_nothing_Abc')).status).toBe(404)
    })

    it('cancelling without JavaScript goes to the API once and the page shows what came back', async () => {
      state.calls = []
      const r = await get('/orders/Tok_pending_confirmation_Abc', { method: 'POST', body: new URLSearchParams({ intent: 'cancel' }), headers: form })
      expect(r.status).toBe(200)
      expect(state.calls).toEqual(['CANCEL'])
    })

    it('the lookup: the order number in any way of writing it, the phone in any way, one answer for every miss, and the way to the order', async () => {
      state.calls = []
      const track = (/** @type {Record<string, string>} */ fields) => get('/track', { method: 'POST', body: new URLSearchParams(fields), headers: form })
      for (const [orderNumber, phone] of [['rb-10458', '0300 1234567'], ['10458', '3001234567'], ['NC 10458', '+92 300 1234567']]) {
        const r = await track({ orderNumber: orderNumber ?? '', phone: phone ?? '' })
        expect(r.status, orderNumber).toBe(303)
        expect(r.headers.get('location'), orderNumber).toBe('/orders/Tok_pending_Abc')
      }
      expect(state.calls.every((c) => c === 'TRACK {"orderNumber":"RB-10458","phone":"+923001234567"}')).toBe(true)
      const wrongPhone = await track({ orderNumber: 'RB-10458', phone: '0300 9999999' })
      const wrongNumber = await track({ orderNumber: 'RB-99999', phone: '0300 1234567' })
      const garbage = await track({ orderNumber: 'abc', phone: 'xyz' })
      const texts = await Promise.all([wrongPhone, wrongNumber, garbage].map(async (r) => [r.status, plain(await r.text()).match(/We could not find an order with that number and mobile number\./)?.[0]]))
      expect(texts).toEqual([[200, 'We could not find an order with that number and mobile number.'], [200, 'We could not find an order with that number and mobile number.'], [200, 'We could not find an order with that number and mobile number.']])
      expect(plain(await (await track({ orderNumber: 'RB-429', phone: '0300 1234567' })).text())).toContain('Too many attempts. Try again in a few minutes or WhatsApp us.')
    })

    it('the lookup page: never cached, not indexed, what was typed comes back after a miss', async () => {
      const r = await get('/track')
      expect(r.headers.get('cache-control')).toBe('private, no-store')
      expect(r.headers.get('x-robots-tag')).toContain('noindex')
      const missed = plain(await (await get('/track', { method: 'POST', body: new URLSearchParams({ orderNumber: 'RB-1', phone: '0300 1234567' }), headers: form })).text())
      expect(missed).toMatch(/<input(?=[^>]*name="orderNumber")(?=[^>]*value="RB-1")[^>]*>/)
    })

    it('the review form of a delivered line: a rating, the fit (it is a sized piece), words and a name; sent through the contract\'s own checks', async () => {
      const page = plain(await (await get(`/orders/Tok_delivered_Abc/review/${uuid(850)}`)).text())
      expect(page).toMatch(/<h1[^>]*>Write a review</)
      expect(page).toContain('name="fit"')
      expect(page).toMatch(/<input(?=[^>]*name="displayName")(?=[^>]*value="Ayesha K\.")[^>]*>/)
      state.calls = []
      const bad = plain(await (await get(`/orders/Tok_delivered_Abc/review/${uuid(850)}`, { method: 'POST', body: new URLSearchParams({ rating: '', body: 'short', displayName: 'Ayesha K.' }), headers: form })).text())
      expect(bad).toContain('Please choose a rating from 1 to 5.')
      expect(bad).toContain('Please write at least 20 characters')
      expect(state.calls).toEqual([]) // nothing was sent
      const ok = await get(`/orders/Tok_delivered_Abc/review/${uuid(850)}`, { method: 'POST', body: new URLSearchParams({ rating: '5', body: 'Lovely fabric and a neat finish.', displayName: 'Ayesha K.', fit: 'true_to_size' }), headers: form })
      expect(ok.status).toBe(303)
      expect(ok.headers.get('location')).toBe('/orders/Tok_delivered_Abc?reviewed=1')
      expect(state.calls).toEqual(['REVIEW {"rating":5,"body":"Lovely fabric and a neat finish.","fit":"true_to_size","displayName":"Ayesha K."}'])
    })

    it('a review picture must be an image of a kind the API takes, and not too big', async () => {
      const send = (/** @type {string} */ type, /** @type {number} */ size) => get(`/orders/Tok_delivered_Abc/review/${uuid(850)}/photo`, { method: 'POST', body: new Uint8Array(size), headers: { 'content-type': type } })
      expect((await send('image/gif', 10)).status).toBe(422)
      // too big: refused before it is read, and the connection is closed, so a client may see the answer or only the close
      const big = await send('image/png', 6 * 1024 * 1024).then((r) => r.status, () => 'closed')
      expect([413, 'closed']).toContain(big)
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

  describe('search engines and link previews (DOC-06.9)', () => {
    /** @param {string} html */
    const ldTypes = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1] ?? 'null')).flat().map((d) => d['@type'])
    const head = (/** @type {string} */ html) => html.slice(html.indexOf('<head'), html.indexOf('</head>'))

    it('the home page: canonical, both languages, preview tags, the shop and its search as data', async () => {
      const r = await get('/')
      const html = await r.text()
      expect(r.headers.get('x-robots-tag')).toBe('noindex, nofollow') // a laptop is not the shop: nothing here is indexed
      expect(html).toContain('<link rel="canonical" href="http://localhost:5174/"')
      expect(html).toContain('property="og:site_name" content="Rubaya"')
      expect(html).toContain('name="twitter:card" content="summary_large_image"')
      expect(ldTypes(html)).toEqual(['Organization', 'WebSite'])
    })

    it('a listing: breadcrumbs and a list as data; sorting is not a page of its own and points at the plain listing', async () => {
      const plain = await (await get('/c/lawn')).text()
      expect(ldTypes(plain)).toEqual(['BreadcrumbList', 'ItemList'])
      expect(head(plain)).toContain('<link rel="canonical" href="http://localhost:5174/c/lawn"')
      expect(head(plain)).not.toContain('name="robots"')
      const sorted = head(await (await get('/c/lawn?sort=newest')).text())
      expect(sorted).toContain('name="robots" content="noindex,follow"')
      expect(sorted).toContain('<link rel="canonical" href="http://localhost:5174/c/lawn"')
      expect(head(await (await get('/search?q=lawn')).text())).toContain('name="robots" content="noindex,follow"')
    })

    it('the product: a group with a Product for each size, the shown price and availability, preview tags of a product, one escaped script', async () => {
      const html = await (await get('/p/dress-1')).text()
      expect(ldTypes(html)).toEqual(['BreadcrumbList', 'ProductGroup'])
      const ld = JSON.parse(/** @type {string} */ (html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)?.[1]?.replace(/^<script[^>]*>|<\/script>$/g, '')))
      expect(ld.hasVariant.map((/** @type {any} */ v) => [v.size, v.offers.price, v.offers.availability])).toEqual([
        ['S', '6990.00', 'https://schema.org/InStock'],
        ['M', '6990.00', 'https://schema.org/OutOfStock'],
        ['L', '7490.00', 'https://schema.org/InStock'],
      ])
      expect(ld.aggregateRating).toEqual({ '@type': 'AggregateRating', ratingValue: '4.6', reviewCount: '38' })
      expect(head(html)).toContain('property="og:type" content="product"')
      expect(head(html)).toContain('property="product:price:amount" content="6990.00"')
      expect(head(html)).toContain('<link rel="canonical" href="http://localhost:5174/p/dress-1"')
    })

    it('a page of a visitor is told to stay out of every index, and so is the 404', async () => {
      for (const p of ['/cart', '/track', '/wishlist']) {
        const r = await get(p)
        expect(r.headers.get('x-robots-tag'), p).toContain('noindex')
        expect(head(await r.text()), p).toContain('name="robots" content="noindex,nofollow"')
      }
      const nf = await get('/nothing-here')
      expect(nf.status).toBe(404)
      expect(await nf.text()).toContain('<title>Page not found | Rubaya</title>')
    })

    it('robots.txt shuts out a copy of the shop; the sitemap lists its files, a file lists the addresses with their pictures, a file beyond the last is a 404', async () => {
      const robots = await get('/robots.txt')
      expect(robots.headers.get('content-type')).toContain('text/plain')
      expect(await robots.text()).toBe('User-agent: *\nDisallow: /\n')
      const index = await (await get('/sitemap.xml')).text()
      expect(index).toContain('<loc>http://localhost:5174/sitemap/1.xml</loc>')
      expect(index).not.toContain('/sitemap/2.xml')
      const file = await get('/sitemap/1.xml')
      expect(file.headers.get('content-type')).toContain('application/xml')
      const xml = await file.text()
      expect(xml).toContain('<loc>http://localhost:5174/p/dress-1</loc><lastmod>2026-10-02T00:00:00.000Z</lastmod><image:image><image:loc>http://localhost/img/p1.webp</image:loc>')
      expect(xml).toContain('<loc>http://localhost:5174/size-guide</loc>')
      expect((await get('/sitemap/2.xml')).status).toBe(404)
      expect((await get('/sitemap/x.xml')).status).toBe(404)
    })
  })

  describe('speed (DOC-06.10)', () => {
    it('the fonts are the shop own: declared in the theme block, the two the theme names started early, none from another host, a stand-in face against layout shift', async () => {
      const html = await (await get('/')).text()
      const style = html.slice(html.indexOf('<style'), html.indexOf('</style>'))
      expect(style).toContain('font-family:"Playfair Display"')
      expect(style).toContain('font-family:"Inter"')
      expect(style).toContain('font-family:"Inter Fallback"')
      expect(style).toMatch(/font-display:swap/)
      expect(style).not.toMatch(/Noto Nastaliq/) // the Urdu face is for Urdu pages
      expect(html.match(/<link[^>]*rel="preload"[^>]*as="font"[^>]*crossorigin="anonymous"[^>]*>/g)).toHaveLength(2)
      expect(html).not.toMatch(/fonts.(googleapis|gstatic).com/)
    })

    it('the product and CMS pages do not send the Markdown library to the browser, and their text is already in the HTML', async () => {
      for (const p of ['/p/dress-1', '/pages/hostile']) {
        const html = await (await get(p)).text()
        expect(html, p).not.toMatch(/modulepreload[^>]*markdown-|src="[^"]*markdown-/)
      }
      expect(await (await get('/p/dress-1')).text()).toContain('Soft <strong>lawn</strong> with care.')
    })

    it('the first cards of a listing load at once without claiming the queue; the hero alone is fetched first', async () => {
      const html = await (await get('/c/lawn')).text()
      expect(html.match(/<img[^>]*loading="eager"/g)?.length).toBeGreaterThanOrEqual(1)
      expect(html).not.toMatch(/<img[^>]*fetchPriority="high"/)
    })

    it('the speed numbers of a browser are passed on as the contract has them, and anything else is dropped with the same quiet answer', async () => {
      state.calls.length = 0
      const post = (/** @type {unknown} */ body) => get('/vitals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const ok = await post({ name: 'LCP', value: 1800.5, route: 'product', navigationType: 'navigate' })
      expect(ok.status).toBe(204)
      expect(state.calls).toEqual(['VITALS {"name":"LCP","value":1800.5,"route":"product","navigationType":"navigate"}'])
      state.calls.length = 0
      expect((await post({ name: 'FID', value: 1, route: 'x' })).status).toBe(204)
      expect((await post('not an object')).status).toBe(204)
      expect((await get('/vitals', { method: 'POST', body: '{broken' })).status).toBe(204)
      expect(state.calls).toEqual([])
      expect((await get('/vitals')).status).toBeGreaterThanOrEqual(400) // there is nothing to read here
    })
  })

  describe('the language prefix (plan/03 section 8)', () => {
    it('/ur is not a page while Urdu is off, and /en is never one', async () => {
      state.ur = false
      for (const p of ['/ur', '/ur/new', '/en', '/fr/new']) expect((await get(p)).status, p).toBe(404)
    })

    it('with Urdu on, /ur answers in Urdu, right to left, and its links stay in Urdu', async () => {
      state.ur = true
      state.wishlist = false
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
      // the shop has the wishlist off: no heart, no link in the header, and no such page
      expect(html).not.toContain('aria-pressed')
      expect(html).not.toContain('href="/ur/wishlist"')
      expect((await get('/ur/wishlist')).status).toBe(404)
      // a page with no Urdu text is shown in English and says so
      const urPage = await (await get('/ur/pages/contact')).text()
      expect(urPage).toMatch(/<h1[^>]*lang="en"/)
      expect(urPage).toMatch(/<div[^>]*lang="en"[^>]*dir="ltr"|<div[^>]*dir="ltr"[^>]*lang="en"/)
      // a listing in Urdu: its links stay in Urdu
      const list = await (await get('/ur/c/lawn')).text()
      expect(list).toContain('href="/ur/c/printed"')
      expect(list).toContain('href="/ur/c/lawn?cursor=c1"')
      expect(list).toContain('پروڈکٹس')
      state.wishlist = true
      state.ur = false
    }, 60_000)
  })
})
