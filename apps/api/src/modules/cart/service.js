// The cart (plan/10-api/03-cart-orders-public.md section 2, plan/09-data-model/06-cart-promotions.md): lines with an identity, one promo, and the price of it all.
// A cart holds no money: every read prices it again through `priceCart`, the same function an order will use (ADR-0020).
import { maxCartLines } from '@noor/contract'
import { DomainError } from '../../platform/errors.js'
import { transaction } from '../../platform/db.js'
import { now } from '../../platform/clock.js'
import { uuidv7 } from '../../platform/ids.js'
import { randomToken, sha256Hex } from '../auth/tokens.js'
import { evaluatePromo } from '../promotions/evaluate.js'
import { customizationHash, customizationIssues, customizationSummary, normalise } from './customization.js'
import { priceCart } from './pricing.js'
import * as repo from './repository.js'

/**
 * @typedef {import('../../platform/db.js').Executor} Db
 * @typedef {import('./pricing.js').PricedLineInput} PricedLineInput
 * @typedef {{ cityId?: string, methodId?: string, phone?: string, images?: boolean }} PriceOptions
 */

const IDLE_DAYS = 30
const DAY = 86_400_000
const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {{ imagesFor: (ids: string[]) => Promise<Record<string, import('@noor/contract').Image>> }} deps.media
 * @param {{ available: (x: Db, ids: string[]) => Promise<Map<string, number>> }} deps.stock
 * @param {{ deliveryOptions: (x: Db, cityId: string) => Promise<import('./pricing.js').DeliveryOption[]> }} deps.shipping
 * @param {{ value: (key: 'payments', x: Db) => Promise<{ value: { methods: { type: import('@noor/contract').PaymentMethod, enabled: boolean, label: string, description?: string, sortOrder: number }[], codLimitMinor?: number } }> }} deps.settings
 * @param {{ findRule: (x: Db, code: string) => Promise<PromoFound | undefined>, findRuleById: (x: Db, id: string) => Promise<PromoFound | undefined>, customerProblem: (x: Db, promo: { id: string, firstOrderOnly: boolean, perCustomerLimit: number | null }, customer: { id: string, ordersCount: number }) => Promise<string | undefined> }} deps.promotions
 * @param {{ findByPhone: (x: Db, phone: string) => Promise<{ id: string, ordersCount: number, noCod: boolean } | undefined> }} deps.customers
 *
 * @typedef {{ id: string, code: string, label: string, firstOrderOnly: boolean, perCustomerLimit: number | null, rule: import('../promotions/evaluate.js').PromoRule }} PromoFound
 */
export function createCartService({ db, media, stock, shipping, settings, promotions, customers }) {
  const emptyCart = () => priceCart({ lines: [], promo: undefined, at: now(), shipping: undefined, payments: undefined, customer: undefined }).cart

  /** Which picture goes with each variant: the one of its option value (a colour), else the product's first. Reads through `x`. @param {Db} x @param {{ id: string, productId: string }[]} vs @returns {Promise<Map<string, string>>} */
  async function mediaIdsOf(x, vs) {
    const [links, valueRows] = await Promise.all([repo.mediaOf(x, [...new Set(vs.map((v) => v.productId))]), repo.optionValuesOf(x, vs.map((v) => v.id))])
    return new Map(
      vs.flatMap((v) => {
        const mine = new Set(valueRows.filter((o) => o.variantId === v.id).map((o) => o.optionValueId))
        const link = links.find((l) => l.productId === v.productId && l.optionValueId && mine.has(l.optionValueId)) ?? links.find((l) => l.productId === v.productId)
        return link ? [/** @type {const} */ ([v.id, link.mediaId])] : []
      }),
    )
  }

  /**
   * The lines of a cart as the pricing needs them: price, stock, names, picture, labels. With `images: false` the pictures themselves are not loaded
   * (they come through the shared pool, which a command holding a transaction must not wait on); the line still carries its `imageMediaId`.
   * @param {Db} x @param {repo.LineRow[]} rows @param {{ images?: boolean }} [o] @returns {Promise<PricedLineInput[]>}
   */
  async function facts(x, rows, { images: withImages = true } = {}) {
    if (!rows.length) return []
    const variantIds = [...new Set(rows.map((r) => r.variantId))]
    const vs = await repo.variantsWithProduct(x, variantIds)
    const productIds = [...new Set(vs.map((v) => v.productId))]
    const [available, labels, cats, mediaIds] = await Promise.all([stock.available(x, variantIds), repo.variantLabels(x, variantIds), repo.categoriesOf(x, productIds), mediaIdsOf(x, vs)])
    const images = withImages ? await media.imagesFor([...new Set(mediaIds.values())]) : {}
    const schemaIds = [...new Set(vs.flatMap((v) => (v.customSizeSchemaId ? [v.customSizeSchemaId] : [])))]
    const schemas = new Map(await Promise.all(schemaIds.map(async (id) => /** @type {const} */ ([id, /** @type {import('@noor/contract').FormField[]} */ ((await repo.formSchemaById(x, id))?.fields ?? [])]))))
    // the chosen variants of bundles, for the one-line summary
    const bundled = [...new Set(rows.flatMap((r) => /** @type {import('@noor/contract').LineCustomization | null} */ (r.customization)?.bundle?.map((b) => b.variantId) ?? []))]
    const bundleVariants = await repo.variantsWithProduct(x, bundled)
    const bundleNames = await repo.variantLabels(x, bundled)
    const bundleLabels = new Map(bundleVariants.map((b) => [b.id, `${b.title}${bundleNames.get(b.id) ? ` (${bundleNames.get(b.id)})` : ''}`]))

    return rows.flatMap((r) => {
      const v = vs.find((x2) => x2.id === r.variantId)
      if (!v) return []
      const customization = /** @type {import('@noor/contract').LineCustomization | null} */ (r.customization) ?? undefined
      const mediaId = mediaIds.get(v.id)
      const image = mediaId ? images[mediaId] : undefined
      const summary = customizationSummary(customization, v.customSizeSchemaId ? (schemas.get(v.customSizeSchemaId) ?? []) : [], bundleLabels)
      const mto = v.mtoLeadMinDays !== null && v.mtoLeadMaxDays !== null
      return [
        /** @type {PricedLineInput} */ ({
          id: r.id, productId: v.productId, variantId: v.id, sku: v.sku, ...(mediaId ? { imageMediaId: mediaId } : {}), handle: v.handle, title: v.title, variantLabel: labels.get(v.id) ?? '',
          ...(image ? { image } : {}), kind: /** @type {import('@noor/contract').ProductKind} */ (v.kind), quantity: r.quantity, unitMinor: v.priceMinor, compareAtMinor: v.compareAtMinor, seenUnitMinor: r.seenUnitPriceMinor,
          stockMode: /** @type {'counted' | 'made_to_order' | 'preorder'} */ (v.stockMode), available: available.get(v.id) ?? 0, sellable: v.enabled && v.status === 'active', maxPerOrder: v.maxPerOrder,
          ...(customization ? { customization } : {}), ...(summary ? { customizationSummary: summary } : {}),
          ...(mto ? { madeToOrder: { leadMinDays: /** @type {number} */ (v.mtoLeadMinDays), leadMaxDays: /** @type {number} */ (v.mtoLeadMaxDays), depositBps: v.mtoDepositBps } } : {}),
          categoryIds: cats.filter((c) => c.productId === v.productId).map((c) => c.categoryId),
        }),
      ]
    })
  }

  /**
   * The price of a cart: the one function a quote and an order both call. With a city it adds delivery and payment options; with a phone it
   * knows the customer's own promo limit and No COD flag. Prices the customer has not seen yet are remembered as seen.
   * @param {Db} x @param {repo.CartRow} cart @param {PriceOptions} [opts]
   */
  async function price(x, cart, { cityId, methodId, phone, images } = {}) {
    const lines = await facts(x, await repo.linesOf(x, cart.id), { images })
    const found = cart.promoId ? await promotions.findRuleById(x, cart.promoId) : undefined
    const customer = phone ? await customers.findByPhone(x, phone) : undefined
    const blockedBy = found && customer ? await promotions.customerProblem(x, found, customer) : undefined
    /** @type {import('./pricing.js').DeliveryOption[] | undefined} */
    let options
    if (cityId) {
      options = await shipping.deliveryOptions(x, cityId)
      if (methodId && !options.some((o) => o.methodId === methodId)) throw new DomainError('shipping_method_invalid')
    }
    const pay = (await settings.value('payments', x)).value
    const priced = priceCart({
      lines,
      promo: found ? { id: found.id, code: found.code, label: found.label, rule: found.rule, ...(blockedBy ? { blockedBy } : {}) } : undefined,
      at: now(),
      shipping: options ? { options, ...(methodId ? { methodId } : {}) } : undefined,
      payments: { methods: pay.methods.filter((m) => m.enabled).sort((a, b) => a.sortOrder - b.sortOrder).map((m) => ({ type: m.type, label: m.label, ...(m.description ? { description: m.description } : {}) })), codLimitMinor: pay.codLimitMinor ?? null },
      customer: customer ? { noCod: customer.noCod } : undefined,
    })
    for (const u of priced.seenUpdates) await repo.updateLine(x, u.lineId, { seenUnitPriceMinor: u.unitMinor })
    return { ...priced, cart: { id: cart.id, ...priced.cart }, facts: lines, customer }
  }

  /** Adds the pictures to a priced cart, reading through the pool: only after the transaction has ended. @template {{ lines: import('@noor/contract').CartLine[] }} C @param {C} c @returns {Promise<C>} */
  async function withImages(c) {
    if (!c.lines.length) return c
    const vs = await repo.variantsWithProduct(db, [...new Set(c.lines.map((l) => l.variantId))])
    const ids = await mediaIdsOf(db, vs)
    const images = await media.imagesFor([...new Set(ids.values())])
    return { ...c, lines: c.lines.map((l) => { const image = images[ids.get(l.variantId) ?? '']; return image ? { ...l, image } : l }) }
  }

  /** A command that changes a cart: one transaction that holds no second connection, then the pictures. @template T @param {(tx: Db) => Promise<T & { lines: import('@noor/contract').CartLine[] }>} fn */
  const inTx = (fn) => transaction(db, fn).then(withImages)

  /** @param {string | undefined} token */
  const hashOf = (token) => (token ? sha256Hex(token) : undefined)

  /** Stock and per-order limits for `quantity` of a variant in a cart, counting the other lines of the same variant. @param {Db} x @param {{ id: string, stockMode: string, maxPerOrder: number }} v @param {number} quantity @param {number} others */
  async function checkQuantity(x, v, quantity, others) {
    const total = quantity + others
    if (total > v.maxPerOrder) throw new DomainError('max_per_order', { variantId: v.id, max: v.maxPerOrder })
    if (v.stockMode === 'counted') {
      const available = (await stock.available(x, [v.id])).get(v.id) ?? 0
      if (total > available) throw new DomainError('insufficient_stock', { variantId: v.id, available: Math.max(0, available) })
    }
  }

  return {
    price,
    facts,

    /**
     * Lines that are not in a cart (an order being edited): the same facts, from the variant ids.
     * @param {Db} x @param {{ id: string, variantId: string, quantity: number, customization?: import('@noor/contract').LineCustomization, seenUnitPriceMinor?: number }[]} wanted
     */
    async factsOf(x, wanted) {
      const now0 = now()
      const rows = wanted.map((w) => /** @type {repo.LineRow} */ ({ id: w.id, cartId: '', variantId: w.variantId, quantity: w.quantity, customization: w.customization ?? null, customizationHash: '', seenUnitPriceMinor: w.seenUnitPriceMinor ?? 0, createdAt: now0, updatedAt: now0 }))
      return facts(x, rows, { images: false })
    },
    withImages,

    /** The cart behind a token, locked until the transaction ends: an order and a quantity change on the same cart wait for each other. @param {Db} x @param {string | undefined} token */
    async lockCartOf(x, token) {
      const h = hashOf(token)
      return h ? repo.lockCartByToken(x, h) : undefined
    },

    /** The order is placed: the cart has done its job. @param {Db} x @param {string} cartId */
    deleteCart: (x, cartId) => repo.deleteCart(x, cartId),

    /**
     * What an order keeps of a line's customisation: the answers as given and, for a bundle, the title, SKU and label of each chosen variant (the catalog may change later).
     * @param {Db} x @param {import('@noor/contract').LineCustomization | undefined} customization
     */
    async snapshotCustomization(x, customization) {
      if (!customization?.bundle?.length) return customization
      const ids = customization.bundle.map((b) => b.variantId)
      const [vs, labels] = await Promise.all([repo.variantsWithProduct(x, ids), repo.variantLabels(x, ids)])
      return { ...customization, bundle: customization.bundle.map((b) => { const v = vs.find((c) => c.id === b.variantId); return { ...b, title: v?.title ?? '', sku: v?.sku ?? '', label: labels.get(b.variantId) ?? '' } }) }
    },

    /** The cart behind a token, if there is one. @param {Db} x @param {string | undefined} token */
    async cartOf(x, token) {
      const h = hashOf(token)
      return h ? repo.cartByToken(x, h) : undefined
    },

    /** No token or an unknown one is an empty cart, and none is made. @param {string | undefined} token @param {boolean} summary */
    async get(token, summary) {
      const h = hashOf(token)
      const cart = h ? await repo.cartByToken(db, h) : undefined
      if (!cart) return summary ? { count: 0 } : emptyCart()
      if (summary) return { count: (await repo.linesOf(db, cart.id)).reduce((s, l) => s + l.quantity, 0) }
      return (await price(db, cart)).cart
    },

    /** @param {string | undefined} token @param {{ variantId: string, quantity: number, customization?: import('@noor/contract').LineCustomization }} input */
    async addLine(token, { variantId, quantity, customization }) {
      return inTx(async (tx) => {
        const h = hashOf(token)
        let cart = h ? await repo.lockCartByToken(tx, h) : undefined
        const [v] = await repo.variantsWithProduct(tx, [variantId])
        if (!v || !v.enabled || v.status !== 'active') throw new DomainError('variant_unavailable', { variantId })

        // the customisation must fit the product: its custom-size form, its note rule, its bundle
        const custom = normalise(customization)
        const form = v.customSizeSchemaId ? await repo.formSchemaById(tx, v.customSizeSchemaId) : undefined
        const bundleChildIds = v.kind === 'bundle' ? await repo.bundleChildren(tx, v.productId) : null
        const issues = customizationIssues(custom, { fields: /** @type {import('@noor/contract').FormField[]} */ (form?.fields ?? []), allowNotes: form?.allowNotes ?? false, bundleChildIds })
        if (custom?.bundle && bundleChildIds) {
          const chosen = await repo.variantsWithProduct(tx, custom.bundle.map((b) => b.variantId))
          custom.bundle.forEach((b, i) => {
            const cv = chosen.find((c) => c.id === b.variantId)
            if (!cv || cv.productId !== b.productId || !cv.enabled || cv.status !== 'active') issues.push({ path: `customization.bundle.${i}.variantId`, code: 'invalid_format' })
          })
        }
        if (issues.length) throw new DomainError('validation_failed', { issues })

        /** @type {string | undefined} */
        let created
        if (!cart) {
          created = randomToken()
          const id = uuidv7()
          const at = now()
          await repo.insertCart(tx, { id, tokenHash: sha256Hex(created), createdAt: at, updatedAt: at })
          cart = /** @type {repo.CartRow} */ (await repo.cartById(tx, id))
        }
        const rows = await repo.linesOf(tx, cart.id)
        const hash = customizationHash(custom)
        const same = rows.find((r) => r.variantId === variantId && r.customizationHash === hash)
        if (!same && rows.length >= maxCartLines) throw new DomainError('cart_full', { max: maxCartLines })
        const others = rows.filter((r) => r.variantId === variantId && r !== same).reduce((s, r) => s + r.quantity, 0)
        const wanted = (same?.quantity ?? 0) + quantity
        await checkQuantity(tx, v, wanted, others)
        const at = now()
        if (same) await repo.updateLine(tx, same.id, { quantity: wanted, updatedAt: at })
        else await repo.insertLine(tx, { id: uuidv7(), cartId: cart.id, variantId, quantity, ...(custom ? { customization: custom } : {}), customizationHash: hash, seenUnitPriceMinor: v.priceMinor, createdAt: at, updatedAt: at })
        await repo.updateCart(tx, cart.id, { updatedAt: at })
        const priced = (await price(tx, cart, { images: false })).cart
        return created ? { ...priced, cartToken: created } : priced
      })
    },

    /** 0 removes the line. @param {string | undefined} token @param {string} lineId @param {number} quantity */
    async setLineQuantity(token, lineId, quantity) {
      return inTx(async (tx) => {
        const h = hashOf(token)
        const cart = h ? await repo.lockCartByToken(tx, h) : undefined
        const line = cart ? await repo.findLine(tx, cart.id, lineId) : undefined
        if (!cart || !line) throw new DomainError('not_found')
        if (quantity === 0) await repo.deleteLine(tx, line.id)
        else {
          const [v] = await repo.variantsWithProduct(tx, [line.variantId])
          if (!v) throw new DomainError('variant_unavailable', { variantId: line.variantId })
          const others = (await repo.linesOf(tx, cart.id)).filter((r) => r.variantId === line.variantId && r.id !== line.id).reduce((s, r) => s + r.quantity, 0)
          await checkQuantity(tx, v, quantity, others)
          await repo.updateLine(tx, line.id, { quantity, updatedAt: now() })
        }
        await repo.updateCart(tx, cart.id, { updatedAt: now() })
        return (await price(tx, cart, { images: false })).cart
      })
    },

    /** @param {string | undefined} token @param {string} lineId */
    removeLine(token, lineId) {
      return this.setLineQuantity(token, lineId, 0)
    },

    /** One code per cart; a new one replaces the old. The code must apply to what is in the cart now. @param {string | undefined} token @param {string} code */
    async applyPromo(token, code) {
      return inTx(async (tx) => {
        const found = await promotions.findRule(tx, code)
        if (!found) throw new DomainError('promo_not_found')
        const h = hashOf(token)
        const cart = h ? await repo.lockCartByToken(tx, h) : undefined
        const lines = cart ? await facts(tx, await repo.linesOf(tx, cart.id)) : []
        const r = evaluatePromo(found.rule, lines.map((l) => ({ productId: l.productId, categoryIds: l.categoryIds, unitMinor: l.unitMinor, quantity: l.quantity, onSale: l.compareAtMinor !== null })), now())
        if (!r.ok) throw new DomainError(r.reason, r.reason === 'promo_min_spend' ? { minSpend: money(found.rule.minSpendMinor ?? 0) } : {})
        const live = /** @type {repo.CartRow} */ (cart) // a code only applies to lines, so there is a cart
        await repo.updateCart(tx, live.id, { promoId: found.id, updatedAt: now() })
        return (await price(tx, { ...live, promoId: found.id }, { images: false })).cart
      })
    },

    /** @param {string | undefined} token */
    async removePromo(token) {
      const h = hashOf(token)
      const cart = h ? await repo.cartByToken(db, h) : undefined
      if (!cart) return emptyCart()
      await repo.updateCart(db, cart.id, { promoId: null, updatedAt: now() })
      return (await price(db, { ...cart, promoId: null })).cart
    },

    /** Delivery and payment for a city. Read-only apart from the prices the customer has now seen. @param {string | undefined} token @param {{ cityId: string, shippingMethodId?: string, phone?: string }} body */
    async quote(token, body) {
      const cart = await this.cartOf(db, token)
      if (!cart || !(await repo.linesOf(db, cart.id)).length) throw new DomainError('cart_empty')
      return (await price(db, cart, { cityId: body.cityId, ...(body.shippingMethodId ? { methodId: body.shippingMethodId } : {}), ...(body.phone ? { phone: body.phone } : {}) })).cart
    },

    /** Carts nobody has touched for 30 days. */
    async cleanup() {
      await repo.deleteIdle(db, new Date(now().getTime() - IDLE_DAYS * DAY))
    },
  }
}
