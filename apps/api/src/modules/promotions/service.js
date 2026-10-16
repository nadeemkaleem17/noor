// Promo codes: what staff make and change, what a cart is checked against, and what an order redeems and gives back
// (plan/09-data-model/06-cart-promotions.md sections 3 and 4, plan/10-api/06 section 4, ADR-0020 section 2).
import { DomainError } from '../../platform/errors.js'
import { transaction } from '../../platform/db.js'
import { now } from '../../platform/clock.js'
import { uuidv7 } from '../../platform/ids.js'
import { diffOf, record } from '../audit/index.js'
import { evaluatePromo, promoStatus, promoWindowProblem } from './evaluate.js'
import * as repo from './repository.js'

/**
 * @typedef {{ staffId: string, name: string, role: string }} Staff
 * @typedef {{ ip: string, userAgent: string, requestId: string }} RequestInfo
 * @typedef {import('../../platform/db.js').Executor} Db
 * @typedef {import('./evaluate.js').PromoRule} PromoRule
 * @typedef {import('@noor/contract').PromoInput} PromoInput
 */

const CURRENCY = /** @type {const} */ ('PKR')
const money = (/** @type {number} */ amount) => ({ amount, currency: CURRENCY })
const orNull = (/** @type {{ amount: number } | undefined} */ m) => (m ? m.amount : null)
const iso = (/** @type {Date | null} */ d) => (d ? d.toISOString() : undefined)

/** @param {unknown} e */
const isDuplicate = (e) => /** @type {{ cause?: { errno?: number }, errno?: number }} */ (e).cause?.errno === 1062 || /** @type {{ errno?: number }} */ (e).errno === 1062

/** `Rs. 2,000`, with paisa only when there are some. @param {number} paisa */
const rs = (paisa) => `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: paisa % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(paisa / 100)}`
/** @param {Date} d */
const day = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', year: 'numeric' }).format(d)

/** What the customer sees beside the code: "10% off", "Rs. 500 off", "Free shipping". @param {repo.PromoRow} p */
const headline = (p) => (p.type === 'percent' ? `${(p.valueBps ?? 0) / 100}% off` : p.type === 'fixed' ? `${rs(p.valueMinor ?? 0)} off` : 'Free shipping')

/** The rule in words: "10% off Lawn and Stitched, up to Rs. 2,000, on orders over Rs. 5,000. Once per customer. From 1 Oct 2026 to 15 Oct 2026." @param {repo.PromoRow} p @param {string[]} labels */
function summarise(p, labels) {
  const what = p.scope === 'all' ? '' : ` ${labels.length ? labels.join(' and ') : p.scope}`
  const head = p.type === 'percent' ? `${(p.valueBps ?? 0) / 100}% off${what || ''}` : p.type === 'fixed' ? `${rs(p.valueMinor ?? 0)} off${what}` : 'Free shipping'
  const parts = [head + (p.maxDiscountMinor ? `, up to ${rs(p.maxDiscountMinor)}` : '') + (p.minSpendMinor ? `, on orders over ${rs(p.minSpendMinor)}` : '') + '.']
  if (p.perCustomerLimit) parts.push(p.perCustomerLimit === 1 ? 'Once per customer.' : `${p.perCustomerLimit} times per customer.`)
  if (p.firstOrderOnly) parts.push('First order only.')
  if (p.excludeSaleItems) parts.push('Not on sale items.')
  if (p.startsAt && p.endsAt) parts.push(`${day(p.startsAt)} to ${day(p.endsAt)}.`)
  else if (p.startsAt) parts.push(`From ${day(p.startsAt)}.`)
  else if (p.endsAt) parts.push(`Until ${day(p.endsAt)}.`)
  return parts.join(' ')
}

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 */
export function createPromotionsService({ db }) {
  /** @param {Staff} a @param {RequestInfo} req */
  const actorOf = (a, req) => ({ actor: { type: /** @type {const} */ ('staff'), id: a.staffId, label: a.name, role: a.role }, ip: req.ip, userAgent: req.userAgent, requestId: req.requestId })

  /** Every category id at or below each of `ids`. @param {Db} x @param {string[]} ids */
  async function withDescendants(x, ids) {
    if (!ids.length) return new Set(/** @type {string[]} */ ([]))
    const all = await repo.allCategories(x)
    /** @type {Map<string | null, string[]>} */
    const children = new Map()
    for (const c of all) children.set(c.parentId, [...(children.get(c.parentId) ?? []), c.id])
    const out = new Set(ids)
    const walk = (/** @type {string} */ id) => {
      for (const child of children.get(id) ?? []) {
        if (out.has(child)) continue
        out.add(child)
        walk(child)
      }
    }
    ids.forEach(walk)
    return out
  }

  /** The row and its targets as the evaluator reads them. @param {Db} x @param {repo.PromoRow} p */
  async function ruleOf(x, p) {
    const targets = await repo.targetsOf(x, [p.id])
    return /** @type {PromoRule} */ ({
      type: /** @type {PromoRule['type']} */ (p.type),
      valueBps: p.valueBps,
      valueMinor: p.valueMinor,
      maxDiscountMinor: p.maxDiscountMinor,
      minSpendMinor: p.minSpendMinor,
      scope: /** @type {PromoRule['scope']} */ (p.scope),
      categoryIds: await withDescendants(x, targets.filter((t) => t.targetType === 'category').map((t) => t.targetId)),
      productIds: new Set(targets.filter((t) => t.targetType === 'product').map((t) => t.targetId)),
      excludeSaleItems: p.excludeSaleItems,
      usageLimit: p.usageLimit,
      usageCount: p.usageCount,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      enabled: p.enabled,
    })
  }

  /** Rows to admin documents, with the target names. Targets whose category or product is gone are left out. @param {Db} x @param {repo.PromoRow[]} rows */
  async function views(x, rows) {
    const at = now()
    const [targets, used] = await Promise.all([repo.targetsOf(x, rows.map((r) => r.id)), repo.usedIds(x, rows.map((r) => r.id))])
    const [cats, prods] = await Promise.all([
      repo.categoryNames(x, [...new Set(targets.filter((t) => t.targetType === 'category').map((t) => t.targetId))]),
      repo.productTitles(x, [...new Set(targets.filter((t) => t.targetType === 'product').map((t) => t.targetId))]),
    ])
    const label = new Map([...cats.map((c) => /** @type {const} */ ([c.id, c.name])), ...prods.map((p) => /** @type {const} */ ([p.id, p.title]))])
    return rows.map((p) => {
      const mine = targets.filter((t) => t.promoId === p.id && label.has(t.targetId)).map((t) => ({ id: t.targetId, type: /** @type {'category' | 'product'} */ (t.targetType), label: /** @type {string} */ (label.get(t.targetId)) }))
      return {
        id: p.id,
        code: p.code,
        type: /** @type {'percent' | 'fixed' | 'free_shipping'} */ (p.type),
        ...(p.valueBps !== null ? { percent: p.valueBps / 100 } : {}),
        ...(p.valueMinor !== null ? { amount: money(p.valueMinor) } : {}),
        ...(p.maxDiscountMinor !== null ? { maxDiscount: money(p.maxDiscountMinor) } : {}),
        ...(p.minSpendMinor !== null ? { minSpend: money(p.minSpendMinor) } : {}),
        scope: /** @type {'all' | 'categories' | 'products'} */ (p.scope),
        ...(mine.length ? { targetIds: mine.map((t) => t.id) } : {}),
        excludeSaleItems: p.excludeSaleItems,
        firstOrderOnly: p.firstOrderOnly,
        ...(p.usageLimit !== null ? { usageLimit: p.usageLimit } : {}),
        ...(p.perCustomerLimit !== null ? { perCustomerLimit: p.perCustomerLimit } : {}),
        ...(p.startsAt ? { startsAt: iso(p.startsAt) } : {}),
        ...(p.endsAt ? { endsAt: iso(p.endsAt) } : {}),
        enabled: p.enabled,
        public: p.isPublic,
        ...(p.note ? { note: p.note } : {}),
        status: promoStatus(p, at),
        usageCount: p.usageCount,
        used: used.has(p.id),
        targets: mine,
        summary: summarise(p, mine.map((t) => t.label)),
        version: p.version,
        createdAt: p.createdAt.toISOString(),
      }
    })
  }

  /** @param {Db} x @param {string} id */
  async function view(x, id) {
    const p = await repo.findById(x, id)
    if (!p) throw new DomainError('not_found')
    return /** @type {NonNullable<Awaited<ReturnType<typeof views>>[number]>} */ ((await views(x, [p]))[0])
  }

  /** The columns of a promo from its input. @param {PromoInput} input */
  const columns = (input) => ({
    code: input.code,
    type: input.type,
    valueBps: input.type === 'percent' && input.percent !== undefined ? input.percent * 100 : null,
    valueMinor: input.type === 'fixed' ? orNull(input.amount) : null,
    maxDiscountMinor: input.type === 'percent' ? orNull(input.maxDiscount) : null,
    minSpendMinor: orNull(input.minSpend),
    scope: input.scope,
    excludeSaleItems: input.excludeSaleItems,
    firstOrderOnly: input.firstOrderOnly,
    usageLimit: input.usageLimit ?? null,
    perCustomerLimit: input.perCustomerLimit ?? null,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    enabled: input.enabled,
    isPublic: input.public,
    note: input.note ?? null,
  })

  /** Targets must exist; a category scope names categories, a products scope names products. @param {Db} x @param {PromoInput} input */
  async function targetRows(x, input) {
    if (input.scope === 'all') return []
    const ids = input.targetIds ?? []
    const found = input.scope === 'categories' ? await repo.categoryNames(x, ids) : await repo.productTitles(x, ids)
    const known = new Set(found.map((f) => f.id))
    const bad = ids.findIndex((id) => !known.has(id))
    if (bad >= 0) throw new DomainError('validation_failed', { issues: [{ path: `targetIds.${bad}`, code: 'invalid_format' }] })
    return ids.map((targetId) => ({ targetType: input.scope === 'categories' ? 'category' : 'product', targetId }))
  }

  /** What changes in the audit trail. @param {Awaited<ReturnType<typeof views>>[number] | null} before @param {Awaited<ReturnType<typeof views>>[number]} after */
  const auditDiff = (before, after) => {
    const pick = (/** @type {typeof after | null} */ v) => (v ? { code: v.code, type: v.type, percent: v.percent, amount: v.amount?.amount, maxDiscount: v.maxDiscount?.amount, minSpend: v.minSpend?.amount, scope: v.scope, targetIds: v.targetIds?.join(','), excludeSaleItems: v.excludeSaleItems, firstOrderOnly: v.firstOrderOnly, usageLimit: v.usageLimit, perCustomerLimit: v.perCustomerLimit, startsAt: v.startsAt, endsAt: v.endsAt, enabled: v.enabled, note: v.note } : {})
    return diffOf(pick(before), pick(after))
  }

  /** @param {Db} x @param {repo.PromoRow | undefined} p */
  async function ruleView(x, p) {
    return p ? { id: p.id, code: p.code, label: headline(p), firstOrderOnly: p.firstOrderOnly, perCustomerLimit: p.perCustomerLimit, rule: await ruleOf(x, p) } : undefined
  }

  return {
    /** @param {Parameters<typeof repo.listPromos>[1]} query */
    async list(query) {
      const { rows, total } = await repo.listPromos(db, query, now())
      return { items: await views(db, rows), total, page: query.page, size: query.size }
    },

    /** What the Offers page shows: promos staff made public that are switched on and whose window is open now. */
    async listPublic() {
      const at = now()
      const rows = (await repo.publicRows(db)).filter((p) => promoStatus(p, at) === 'active')
      return {
        items: (await views(db, rows)).map((p) => ({ code: p.code, summary: p.summary, ...(p.minSpend ? { minSpend: p.minSpend } : {}), ...(p.endsAt ? { endsAt: p.endsAt } : {}) })),
      }
    },

    /** @param {string} id */
    get: (id) => view(db, id),

    /** @param {Staff} actor @param {PromoInput} input @param {RequestInfo} req */
    async create(actor, input, req) {
      const id = uuidv7()
      const at = now()
      try {
        await transaction(db, async (tx) => {
          const targets = await targetRows(tx, input)
          await repo.insert(tx, { id, ...columns(input), createdAt: at, updatedAt: at })
          await repo.replaceTargets(tx, id, targets)
          await record(tx, { ...actorOf(actor, req), action: 'promo.created', entityType: 'promo', entityId: id, entityLabel: input.code, category: 'money', diff: auditDiff(null, await view(tx, id)) })
        })
      } catch (e) {
        if (isDuplicate(e)) throw new DomainError('validation_failed', { issues: [{ path: 'code', code: 'not_unique' }] })
        throw e
      }
      return view(db, id)
    },

    /** The code and the type of a promo that has been used cannot change: past orders refer to them. @param {Staff} actor @param {string} id @param {PromoInput & { version: number }} input @param {RequestInfo} req */
    async update(actor, id, input, req) {
      try {
        await transaction(db, async (tx) => {
          const p = await repo.lockById(tx, id)
          if (!p) throw new DomainError('not_found')
          if (p.version !== input.version) throw new DomainError('stale_write', { currentVersion: p.version })
          if ((await repo.redemptionCount(tx, id)) > 0) {
            /** @type {{ path: string, code: 'invalid_format' }[]} */
            const issues = []
            if (input.code !== p.code) issues.push({ path: 'code', code: 'invalid_format' })
            if (input.type !== p.type) issues.push({ path: 'type', code: 'invalid_format' })
            if (issues.length) throw new DomainError('validation_failed', { issues })
          }
          const before = await view(tx, id)
          const targets = await targetRows(tx, input)
          await repo.update(tx, id, { ...columns(input), version: p.version + 1, updatedAt: now() })
          await repo.replaceTargets(tx, id, targets)
          await record(tx, { ...actorOf(actor, req), action: 'promo.updated', entityType: 'promo', entityId: id, entityLabel: input.code, category: 'money', diff: auditDiff(before, await view(tx, id)) })
        })
      } catch (e) {
        if (isDuplicate(e)) throw new DomainError('validation_failed', { issues: [{ path: 'code', code: 'not_unique' }] })
        throw e
      }
      return view(db, id)
    },

    /** Only a code nobody used can go; a used one is disabled instead. @param {Staff} actor @param {string} id @param {RequestInfo} req */
    async delete(actor, id, req) {
      await transaction(db, async (tx) => {
        const p = await repo.lockById(tx, id)
        if (!p) throw new DomainError('not_found')
        const uses = await repo.redemptionCount(tx, id)
        if (uses > 0) throw new DomainError('in_use', { usedBy: { orders: uses } })
        await repo.remove(tx, id)
        await record(tx, { ...actorOf(actor, req), action: 'promo.deleted', entityType: 'promo', entityId: id, entityLabel: p.code, category: 'money' })
      })
    },

    /** Turns codes on or off, each on its own: a code that is gone is reported, the rest are done. @param {Staff} actor @param {string[]} ids @param {'enable' | 'disable'} action @param {RequestInfo} req */
    async bulk(actor, ids, action, req) {
      /** @type {string[]} */
      const succeeded = []
      /** @type {{ id: string, code: string }[]} */
      const failed = []
      for (const id of ids) {
        try {
          await transaction(db, async (tx) => {
            const p = await repo.lockById(tx, id)
            if (!p) throw new DomainError('not_found')
            const enabled = action === 'enable'
            if (p.enabled === enabled) return
            await repo.update(tx, id, { enabled, version: p.version + 1, updatedAt: now() })
            await record(tx, { ...actorOf(actor, req), action: 'promo.updated', entityType: 'promo', entityId: id, entityLabel: p.code, category: 'money', diff: { enabled: [p.enabled, enabled] } })
          })
          succeeded.push(id)
        } catch (e) {
          if (!(e instanceof DomainError)) throw e
          failed.push({ id, code: e.code })
        }
      }
      return { succeeded, failed }
    },

    /**
     * What a code would do to some variants, before it is saved. The same `evaluatePromo` the cart uses, so the numbers match (a new code has no uses yet).
     * @param {PromoInput} input @param {{ variantId: string, quantity: number }[]} lines
     */
    async preview(input, lines) {
      const facts = await repo.variantFacts(db, [...new Set(lines.map((l) => l.variantId))])
      const byId = new Map(facts.map((f) => [f.id, f]))
      const missing = lines.findIndex((l) => !byId.has(l.variantId))
      if (missing >= 0) throw new DomainError('validation_failed', { issues: [{ path: `lines.${missing}.variantId`, code: 'invalid_format' }] })
      const priced = lines.map((l) => {
        const f = /** @type {NonNullable<ReturnType<typeof byId.get>>} */ (byId.get(l.variantId))
        return { variantId: l.variantId, line: { productId: f.productId, categoryIds: f.categoryIds, unitMinor: f.priceMinor, quantity: l.quantity, onSale: f.compareAtMinor !== null } }
      })
      const c = columns(input)
      const targetIds = input.targetIds ?? []
      const rule = /** @type {PromoRule} */ ({
        ...c,
        type: input.type,
        scope: input.scope,
        categoryIds: input.scope === 'categories' ? await withDescendants(db, targetIds) : new Set(),
        productIds: new Set(input.scope === 'products' ? targetIds : []),
        usageCount: 0,
      })
      const r = evaluatePromo(rule, priced.map((p) => p.line), now())
      return {
        applies: r.ok,
        ...(r.ok ? {} : { reason: r.reason }),
        discount: money(r.ok ? r.discount : 0),
        eligibleSubtotal: money(r.eligibleSubtotal),
        lineDiscounts: priced.map((p, i) => ({ variantId: p.variantId, discount: money(r.ok ? (r.lineDiscounts[i] ?? 0) : 0) })),
      }
    },

    /**
     * The code a cart or an order asks about: its rule and its id, or nothing. For the cart this is a read; the order re-checks inside its transaction through `redeem`.
     * @param {Db} x @param {string} rawCode
     */
    async findRule(x, rawCode) {
      return ruleView(x, await repo.findByCode(x, rawCode.trim().toUpperCase()))
    },

    /** The same, for a code a cart already holds. @param {Db} x @param {string} id */
    async findRuleById(x, id) {
      return ruleView(x, await repo.findById(x, id))
    },

    /**
     * What only the customer decides: their own limit and the first-order rule. Checked when the phone is known (a quote) and again in the order.
     * @param {Db} x @param {{ id: string, firstOrderOnly: boolean, perCustomerLimit: number | null }} promo @param {{ id: string, ordersCount: number }} customer
     */
    async customerProblem(x, promo, customer) {
      if (promo.firstOrderOnly && customer.ordersCount > 0) return /** @type {const} */ ('promo_first_order_only')
      if (promo.perCustomerLimit !== null && (await repo.customerUses(x, promo.id, customer.id, false)) >= promo.perCustomerLimit) return /** @type {const} */ ('promo_customer_limit')
      return undefined
    },

    /**
     * In the order's transaction: locks the code, checks its limits again against the live count, writes the redemption and counts it
     * (ADR-0020 section 2). Two orders racing for the last use: the second one waits on the lock, then finds the limit reached.
     * @param {Db} tx
     * @param {{ promoId: string, orderId: string, customer: { id: string, ordersCount: number }, discountMinor: number, shippingWaivedMinor?: number }} r
     */
    async redeem(tx, r) {
      const p = await repo.lockById(tx, r.promoId)
      if (!p) throw new DomainError('promo_not_found')
      const problem = promoWindowProblem(await ruleOf(tx, p), now())
      if (problem) throw new DomainError(problem)
      if (p.firstOrderOnly && r.customer.ordersCount > 0) throw new DomainError('promo_first_order_only')
      if (p.perCustomerLimit !== null && (await repo.customerUses(tx, p.id, r.customer.id)) >= p.perCustomerLimit) throw new DomainError('promo_customer_limit')
      await repo.insertRedemption(tx, { id: uuidv7(), promoId: p.id, orderId: r.orderId, customerId: r.customer.id, discountMinor: r.discountMinor, shippingWaivedMinor: r.shippingWaivedMinor ?? 0, createdAt: now() })
      await repo.update(tx, p.id, { usageCount: p.usageCount + 1 })
    },

    /** An order was edited: what its code gave changes with it. @param {Db} tx @param {string} orderId @param {{ discountMinor: number, shippingWaivedMinor: number }} amounts */
    async updateRedemption(tx, orderId, { discountMinor, shippingWaivedMinor }) {
      const redemption = await repo.redemptionOfOrder(tx, orderId)
      if (redemption && !redemption.reversedAt) await repo.updateRedemption(tx, redemption.id, { discountMinor, shippingWaivedMinor })
    },

    /** An order was cancelled: the use is given back, once. A second call does nothing. @param {Db} tx @param {string} orderId */
    async reverse(tx, orderId) {
      const redemption = await repo.redemptionOfOrder(tx, orderId)
      if (!redemption || redemption.reversedAt) return
      const p = await repo.lockById(tx, redemption.promoId)
      await repo.reverseRedemption(tx, redemption.id, now())
      if (p) await repo.update(tx, p.id, { usageCount: Math.max(0, p.usageCount - 1) })
    },
  }
}
