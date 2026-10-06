// What the cart and order tests share: a storefront request, a product to buy, delivery to a city, a promo code. They go through the real HTTP API.
import { eq } from 'drizzle-orm'
import { products } from '../../src/db/schema/products.js'
import { categories } from '../../src/db/schema/taxonomy.js'
import { uuidv7 } from '../../src/platform/ids.js'
import { app, signedIn, t } from './staff.js'

export const pkr = (/** @type {number} */ paisa) => ({ amount: paisa, currency: 'PKR' })

let seq = 0
/**
 * A storefront request. Each gets its own client address, so the per-address limits never get in the way (pass `ip` to test them).
 * @param {string} method @param {string} url @param {{ token?: string, body?: object, headers?: Record<string, string>, ip?: string }} [o]
 */
export async function shop(method, url, { token, body, headers = {}, ip } = {}) {
  const r = await app.inject({
    method: /** @type {'GET'} */ (method),
    url: `/api/v1${url}`,
    remoteAddress: ip ?? `10.77.${Math.floor(++seq / 250)}.${(seq % 250) + 1}`,
    headers: { ...(token ? { 'x-cart-token': token } : {}), ...headers },
    ...(body ? { payload: body } : {}),
  })
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : undefined, headers: r.headers }
}

/** @param {string | undefined} token @param {string} variantId @param {number} [quantity] @param {object} [customization] */
export const add = (token, variantId, quantity = 1, customization = undefined) =>
  shop('POST', '/cart/lines', { ...(token ? { token } : {}), body: { variantId, quantity, ...(customization ? { customization } : {}) } })

/** The state of one test file: the signed-in owner, a category, and a city with a zone. `setup()` before a test, `delivery()` when it needs a city. */
export function createShop() {
  const S = {
    /** @type {Awaited<ReturnType<typeof signedIn>>['b']} */
    owner: /** @type {never} */ (undefined),
    cat: '',
    cityId: '',
    zoneId: '',
    methodId: '',
    expressId: '',

    async setup() {
      ;({ b: S.owner } = await signedIn('owner'))
      S.cat = uuidv7()
      await t.db.insert(categories).values({ id: S.cat, handle: `c-${S.cat.slice(-6)}`, name: 'Women', createdAt: new Date(), updatedAt: new Date() })
    },

    /** One zone with Lahore in it: Standard Rs. 250, free over Rs. 5,000; Express Rs. 450. */
    async delivery() {
      const city = await S.owner.call('POST', '/admin/shipping/cities', { body: { name: 'Lahore', province: 'Punjab' } })
      S.cityId = city.body.id
      const zone = await S.owner.call('POST', '/admin/shipping/zones', {
        body: {
          name: 'Major', cityIds: [S.cityId],
          methods: [
            { label: 'Standard', fee: pkr(25000), freeAbove: pkr(500000), etaMinDays: 3, etaMaxDays: 5, codAllowed: true, enabled: true },
            { label: 'Express', fee: pkr(45000), etaMinDays: 1, etaMaxDays: 2, codAllowed: true, enabled: true },
          ],
        },
      })
      if (zone.status !== 201) throw new Error(JSON.stringify(zone.body))
      S.zoneId = zone.body.id
      S.methodId = zone.body.methods.find((/** @type {{ label: string }} */ m) => m.label === 'Standard').id
      S.expressId = zone.body.methods.find((/** @type {{ label: string }} */ m) => m.label === 'Express').id
    },

    /** A product with one variant, active unless said otherwise. @param {{ price?: number, compareAt?: number, stock?: number, mode?: string, enabled?: boolean, status?: string, schema?: string, kind?: string, maxPerOrder?: number, mto?: boolean, title?: string }} [o] */
    async product({ price = 500000, compareAt, stock = 10, mode = 'counted', enabled = true, status = 'active', schema, kind = 'stitched', maxPerOrder = 10, mto = false, title } = {}) {
      const handle = `p-${uuidv7().slice(-8)}`
      const r = await S.owner.call('POST', '/admin/products', {
        body: {
          handle, status: 'draft', kind, title: title ?? `Product ${handle.slice(-4)}`, primaryCategoryId: S.cat, categoryIds: [], attributes: [], media: [], options: [],
          ...(schema ? { customSizeSchemaId: schema } : {}),
          ...(mto ? { madeToOrder: { leadMinDays: 10, leadMaxDays: 14, returnable: false, depositPercent: 30 } } : {}),
          variants: [{ key: 'v', sku: handle.toUpperCase().slice(0, 40), optionValueKeys: [], price: pkr(price), ...(compareAt ? { compareAt: pkr(compareAt) } : {}), stockMode: mode, maxPerOrder, enabled }],
          ...(mode === 'counted' && stock ? { initialStock: [{ variantKey: 'v', quantity: stock }] } : {}),
        },
      })
      if (r.status !== 201) throw new Error(JSON.stringify(r.body))
      const productId = /** @type {string} */ (r.body.id)
      await t.db.update(products).set({ status }).where(eq(products.id, productId))
      return { productId, variantId: /** @type {string} */ (r.body.variants[0].id), sku: /** @type {string} */ (r.body.variants[0].sku) }
    },

    /** @param {string} code @param {object} [over] */
    promo: (code, over = {}) => S.owner.call('POST', '/admin/promos', { body: { code, type: 'percent', percent: 10, scope: 'all', excludeSaleItems: true, firstOrderOnly: false, enabled: true, ...over } }),
  }
  return S
}
