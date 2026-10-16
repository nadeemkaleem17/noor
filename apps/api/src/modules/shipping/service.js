// Delivery: cities, zones with their methods, couriers, the public city list, and `quote` (plan/09-data-model/09 section 4,
// plan/10-api/07 section 5). A city is in at most one zone (primary key); the store may never be left with no deliverable city.
import { DomainError } from '../../platform/errors.js'
import { transaction } from '../../platform/db.js'
import { now } from '../../platform/clock.js'
import { uuidv7 } from '../../platform/ids.js'
import { emit } from '../../platform/outbox.js'
import { diffOf, record } from '../audit/index.js'
import * as repo from './repository.js'

/**
 * @typedef {{ staffId: string, name: string, role: string }} Staff
 * @typedef {{ ip: string, userAgent: string, requestId: string }} RequestInfo
 * @typedef {import('@noor/contract').ZoneInput} ZoneInput
 * @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').CityInput>} CityInput
 * @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').CourierInput>} CourierInput
 */

const CURRENCY = /** @type {const} */ ('PKR')
/** A shipping change shows up in the storefront configuration and the city list. */
const TAGS = ['store-config']

/** @param {unknown} e */
const isDuplicate = (e) => /** @type {{ cause?: { errno?: number }, errno?: number }} */ (e).cause?.errno === 1062 || /** @type {{ errno?: number }} */ (e).errno === 1062

/** `Rs. 3,000`, with paisa only when there are some. @param {number} paisa */
export const rs = (paisa) => `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: paisa % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(paisa / 100)}`

/** @param {number} amount */
const money = (amount) => ({ amount, currency: CURRENCY })

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 */
export function createShippingService({ db }) {
  /** @param {Staff} a @param {RequestInfo} req */
  const actorOf = (a, req) => ({ actor: { type: /** @type {const} */ ('staff'), id: a.staffId, label: a.name, role: a.role }, ip: req.ip, userAgent: req.userAgent, requestId: req.requestId })

  /** @param {repo.MethodRow} m */
  const toMethod = (m) => {
    const ur = /** @type {{ ur?: { label?: string } } | null} */ (m.i18n)?.ur
    return {
      id: m.id,
      label: m.label,
      fee: money(m.feeMinor),
      ...(m.freeAboveMinor === null ? {} : { freeAbove: money(m.freeAboveMinor) }),
      etaMinDays: m.etaMinDays,
      etaMaxDays: m.etaMaxDays,
      codAllowed: m.codAllowed,
      enabled: m.enabled,
      ...(ur?.label ? { i18n: { ur: { label: ur.label } } } : {}),
    }
  }

  /** @param {repo.CityRow} c @param {{ id: string, name: string } | undefined} zone */
  const toCity = (c, zone) => ({
    id: c.id,
    name: c.name,
    province: c.province,
    aliases: /** @type {string[] | null} */ (c.aliases) ?? [],
    isMajor: c.isMajor,
    ...(zone ? { zone } : {}),
  })

  /** Every zone as the admin sees it. @param {import('../../platform/db.js').Executor} x */
  async function zoneViews(x) {
    const [zones, methods, assigned] = await Promise.all([repo.allZones(x), repo.methodsOf(x), repo.assignments(x)])
    return zones.map((z) => {
      const here = assigned.filter((a) => a.zoneId === z.id)
      return {
        id: z.id,
        name: z.name,
        version: z.version,
        cityCount: here.length,
        cities: here.slice(0, 50).map((a) => ({ id: a.cityId, name: a.name })),
        methods: methods.filter((m) => m.zoneId === z.id).map(toMethod),
      }
    })
  }

  /** @param {import('../../platform/db.js').Executor} x @param {string} id */
  async function zoneView(x, id) {
    const v = (await zoneViews(x)).find((z) => z.id === id)
    if (!v) throw new DomainError('not_found')
    return v
  }

  /** @param {import('../../platform/db.js').Executor} x @param {string} id */
  async function snapshot(x, id) {
    const z = await zoneView(x, id)
    const cities = (await repo.assignments(x)).filter((a) => a.zoneId === id).map((a) => a.name)
    return { name: z.name, cities, methods: z.methods.map((m) => ({ ...m, i18n: undefined })) }
  }

  /** Cities must exist and appear once. @param {import('../../platform/db.js').Executor} x @param {string[]} ids */
  async function checkCities(x, ids) {
    /** @type {{ path: string, code: 'invalid_format' | 'not_unique' }[]} */
    const issues = []
    const seen = new Set()
    ids.forEach((id, i) => {
      if (seen.has(id)) issues.push({ path: `cityIds.${i}`, code: 'not_unique' })
      seen.add(id)
    })
    const found = new Set((await repo.citiesByIds(x, [...seen])).map((c) => c.id))
    ids.forEach((id, i) => {
      if (!found.has(id)) issues.push({ path: `cityIds.${i}`, code: 'invalid_format' })
    })
    if (issues.length) throw new DomainError('validation_failed', { issues })
  }

  /**
   * Creates (`id` null) or replaces a zone: its name, its cities (taken from any other zone), its methods (matched by id).
   * @param {Staff} actor @param {string | null} id @param {ZoneInput & { version?: number }} input @param {RequestInfo} req
   */
  async function saveZone(actor, id, input, req) {
    const zoneId = id ?? uuidv7()
    try {
      await transaction(db, async (tx) => {
        const deliverableBefore = await repo.deliverableCount(tx)
        const at = now()
        /** @type {Awaited<ReturnType<typeof snapshot>> | Record<string, never>} */
        let before = {}
        if (id) {
          const zone = await repo.lockZone(tx, id)
          if (!zone) throw new DomainError('not_found')
          if (zone.version !== input.version) throw new DomainError('stale_write', { currentVersion: zone.version })
          before = await snapshot(tx, id)
        }
        await checkCities(tx, input.cityIds)
        const existing = id ? await repo.methodsOf(tx, [id]) : []
        const ownIds = new Set(existing.map((m) => m.id))
        const unknown = input.methods.findIndex((m) => m.id && !ownIds.has(m.id))
        if (unknown >= 0) throw new DomainError('validation_failed', { issues: [{ path: `methods.${unknown}.id`, code: 'invalid_format' }] })

        if (id) await repo.updateZone(tx, id, { name: input.name, version: (input.version ?? 0) + 1, updatedAt: at })
        else await repo.insertZone(tx, { id: zoneId, name: input.name, sortOrder: await repo.zoneCount(tx), version: 1, createdAt: at, updatedAt: at })

        const kept = new Set(input.methods.flatMap((m) => (m.id ? [m.id] : [])))
        await repo.deleteMethods(tx, existing.filter((m) => !kept.has(m.id)).map((m) => m.id))
        for (const [i, m] of input.methods.entries()) {
          const columns = {
            label: m.label, feeMinor: m.fee.amount, freeAboveMinor: m.freeAbove?.amount ?? null, etaMinDays: m.etaMinDays, etaMaxDays: m.etaMaxDays,
            codAllowed: m.codAllowed, enabled: m.enabled, sortOrder: i, i18n: m.i18n?.ur?.label ? { ur: { label: m.i18n.ur.label } } : null, updatedAt: at,
          }
          if (m.id) await repo.updateMethod(tx, m.id, columns)
          else await repo.insertMethod(tx, { id: uuidv7(), zoneId, ...columns, createdAt: at })
        }

        // a city claimed here leaves its old zone in the same transaction, so it is never in two
        await repo.unassignZone(tx, zoneId)
        await repo.unassign(tx, input.cityIds)
        await repo.assign(tx, zoneId, input.cityIds)

        if (id && deliverableBefore > 0 && (await repo.deliverableCount(tx)) === 0) throw new DomainError('no_deliverable_city')
        await record(tx, { ...actorOf(actor, req), action: id ? 'shipping.zone_updated' : 'shipping.zone_created', entityType: 'shipping_zone', entityId: zoneId, entityLabel: input.name, diff: diffOf(before, await snapshot(tx, zoneId)), category: 'money' })
        await emit(tx, { type: 'settings.updated', payload: { key: 'shipping', tags: TAGS }, requestId: req.requestId })
      })
    } catch (e) {
      if (isDuplicate(e)) throw new DomainError('validation_failed', { issues: [{ path: 'name', code: 'not_unique' }] })
      throw e
    }
    return zoneView(db, zoneId)
  }

  /** A city with the zone it is in. @param {string} id */
  async function cityView(id) {
    const c = /** @type {repo.CityRow} */ (await repo.findCity(db, id))
    const a = (await repo.assignments(db)).find((x) => x.cityId === id)
    const zone = a ? (await repo.allZones(db)).find((z) => z.id === a.zoneId) : undefined
    return toCity(c, zone ? { id: zone.id, name: zone.name } : undefined)
  }

  /** The cheapest enabled method per zone that has cities: what "from Rs. 250" and the ETA strip are built from. */
  async function cheapestPerZone() {
    const [methods, assigned] = await Promise.all([repo.methodsOf(db), repo.assignments(db)])
    const served = new Set(assigned.map((a) => a.zoneId))
    const enabled = methods.filter((m) => m.enabled && served.has(m.zoneId))
    const cheapest = [...new Set(enabled.map((m) => m.zoneId))].map((z) => /** @type {repo.MethodRow} */ (enabled.filter((m) => m.zoneId === z).sort((a, b) => a.feeMinor - b.feeMinor || a.sortOrder - b.sortOrder)[0]))
    return { enabled, cheapest }
  }

  return {
    // ================================ zones ================================
    async listZones() {
      return { items: await zoneViews(db), unassignedCityCount: await repo.unassignedCount(db) }
    },
    createZone: (/** @type {Staff} */ actor, /** @type {ZoneInput} */ input, /** @type {RequestInfo} */ req) => saveZone(actor, null, input, req),
    updateZone: (/** @type {Staff} */ actor, /** @type {string} */ id, /** @type {ZoneInput & { version: number }} */ input, /** @type {RequestInfo} */ req) => saveZone(actor, id, input, req),

    /** @param {Staff} actor @param {string} id @param {RequestInfo} req */
    async deleteZone(actor, id, req) {
      await transaction(db, async (tx) => {
        const zone = await repo.lockZone(tx, id)
        if (!zone) throw new DomainError('not_found')
        const deliverableBefore = await repo.deliverableCount(tx)
        const before = await snapshot(tx, id)
        await repo.deleteZone(tx, id) // its cities become unassigned, its methods go with it
        if (deliverableBefore > 0 && (await repo.deliverableCount(tx)) === 0) throw new DomainError('no_deliverable_city')
        await record(tx, { ...actorOf(actor, req), action: 'shipping.zone_deleted', entityType: 'shipping_zone', entityId: id, entityLabel: zone.name, diff: diffOf(before, {}), category: 'money' })
        await emit(tx, { type: 'settings.updated', payload: { key: 'shipping', tags: TAGS }, requestId: req.requestId })
      })
    },

    /** What saving this zone would change, shown before the save. @param {string} id @param {ZoneInput} input */
    async zoneImpact(id, input) {
      if (!(await repo.findZone(db, id))) throw new DomainError('not_found')
      await checkCities(db, input.cityIds)
      const assigned = await repo.assignments(db)
      const zones = new Map((await repo.allZones(db)).map((z) => [z.id, z.name]))
      const chosen = new Set(input.cityIds)
      return {
        citiesRemoved: assigned.filter((a) => a.zoneId === id && !chosen.has(a.cityId)).length,
        citiesMovedIn: assigned.filter((a) => a.zoneId !== id && chosen.has(a.cityId)).map((a) => ({ city: a.name, fromZone: zones.get(a.zoneId) ?? '' })),
        openCarts: 0, // ponytail: carts arrive with the cart module (M1-10+); then count carts whose last quote used a removed city
      }
    },

    // ================================ cities ================================
    /** @param {{ q?: string, province?: string, unassigned?: boolean, page: number, size: number }} query */
    async listCities(query) {
      const { rows, total } = await repo.listCities(db, query)
      const zones = new Map((await repo.allZones(db)).map((z) => [z.id, { id: z.id, name: z.name }]))
      return { items: rows.map((r) => toCity(r.city, r.zoneId ? zones.get(r.zoneId) : undefined)), total, page: query.page, size: query.size }
    },

    /** @param {Staff} actor @param {CityInput} input @param {RequestInfo} req */
    async createCity(actor, input, req) {
      const id = uuidv7()
      try {
        await transaction(db, async (tx) => {
          await repo.insertCity(tx, { id, name: input.name, province: input.province, aliases: input.aliases ?? [], isMajor: input.isMajor ?? false, createdAt: now() })
          await record(tx, { ...actorOf(actor, req), action: 'shipping.city_created', entityType: 'city', entityId: id, entityLabel: input.name, diff: diffOf({}, { name: input.name, province: input.province }) })
        })
      } catch (e) {
        if (isDuplicate(e)) throw new DomainError('validation_failed', { issues: [{ path: 'name', code: 'not_unique' }] })
        throw e
      }
      return cityView(id)
    },

    /** @param {Staff} actor @param {string} id @param {CityInput} input @param {RequestInfo} req */
    async updateCity(actor, id, input, req) {
      try {
        await transaction(db, async (tx) => {
          const c = await repo.findCity(tx, id)
          if (!c) throw new DomainError('not_found')
          const after = { name: input.name, province: input.province, aliases: input.aliases ?? [], isMajor: input.isMajor ?? c.isMajor }
          await repo.updateCity(tx, id, after)
          await record(tx, { ...actorOf(actor, req), action: 'shipping.city_updated', entityType: 'city', entityId: id, entityLabel: input.name, diff: diffOf({ name: c.name, province: c.province, aliases: c.aliases ?? [], isMajor: c.isMajor }, after) })
          await emit(tx, { type: 'settings.updated', payload: { key: 'shipping', tags: TAGS }, requestId: req.requestId })
        })
      } catch (e) {
        if (isDuplicate(e)) throw new DomainError('validation_failed', { issues: [{ path: 'name', code: 'not_unique' }] })
        throw e
      }
      return cityView(id)
    },

    /** "Paste a list": names and alternate spellings, any case. @param {string[]} names */
    async matchCities(names) {
      const all = await repo.citiesByIds(db)
      const zones = new Map((await repo.allZones(db)).map((z) => [z.id, { id: z.id, name: z.name }]))
      const zoneOf = new Map((await repo.assignments(db)).map((a) => [a.cityId, zones.get(a.zoneId)]))
      /** @type {Map<string, repo.CityRow>} */
      const byName = new Map()
      for (const c of all) {
        byName.set(c.name.toLowerCase(), c)
        for (const alias of /** @type {string[] | null} */ (c.aliases) ?? []) if (!byName.has(alias.toLowerCase())) byName.set(alias.toLowerCase(), c)
      }
      /** @type {{ input: string, city: ReturnType<typeof toCity> }[]} */
      const matched = []
      /** @type {string[]} */
      const unknown = []
      for (const input of names) {
        const c = byName.get(input.trim().toLowerCase())
        if (c) matched.push({ input, city: toCity(c, zoneOf.get(c.id)) })
        else unknown.push(input)
      }
      return { matched, unknown }
    },

    // ================================ couriers ================================
    async listCouriers() {
      return { items: (await repo.allCouriers(db)).map(toCourier) }
    },

    /** @param {Staff} actor @param {CourierInput} input @param {RequestInfo} req */
    async createCourier(actor, input, req) {
      const id = uuidv7()
      try {
        await transaction(db, async (tx) => {
          const sortOrder = input.sortOrder ?? (await repo.allCouriers(tx)).length
          await repo.insertCourier(tx, { id, name: input.name, trackingUrlPattern: input.trackingUrlPattern ?? null, trackingRequired: input.trackingRequired, enabled: input.enabled, sortOrder })
          await record(tx, { ...actorOf(actor, req), action: 'courier.created', entityType: 'courier', entityId: id, entityLabel: input.name, diff: diffOf({}, courierDoc(input)) })
        })
      } catch (e) {
        if (isDuplicate(e)) throw new DomainError('validation_failed', { issues: [{ path: 'name', code: 'not_unique' }] })
        throw e
      }
      return toCourier(/** @type {CourierRow} */ (await repo.findCourier(db, id)))
    },

    /** Couriers are disabled, never deleted: orders refer to them. @param {Staff} actor @param {string} id @param {CourierInput} input @param {RequestInfo} req */
    async updateCourier(actor, id, input, req) {
      try {
        await transaction(db, async (tx) => {
          const c = await repo.findCourier(tx, id)
          if (!c) throw new DomainError('not_found')
          const sortOrder = input.sortOrder ?? c.sortOrder
          await repo.updateCourier(tx, id, { name: input.name, trackingUrlPattern: input.trackingUrlPattern ?? null, trackingRequired: input.trackingRequired, enabled: input.enabled, sortOrder })
          await record(tx, { ...actorOf(actor, req), action: 'courier.updated', entityType: 'courier', entityId: id, entityLabel: input.name, diff: diffOf(courierDoc(toCourier(c)), courierDoc({ ...input, sortOrder })) })
        })
      } catch (e) {
        if (isDuplicate(e)) throw new DomainError('validation_failed', { issues: [{ path: 'name', code: 'not_unique' }] })
        throw e
      }
      return toCourier(/** @type {CourierRow} */ (await repo.findCourier(db, id)))
    },

    // ================================ public and checkout ================================
    /** Cities the checkout may offer: those in a zone with an enabled method, major ones first. */
    async publicCities() {
      const rows = await repo.deliverableCities(db)
      rows.sort((a, b) => Number(b.isMajor) - Number(a.isMajor) || a.name.localeCompare(b.name))
      const { cheapest } = await cheapestPerZone()
      const method = new Map(cheapest.map((m) => [m.zoneId, m]))
      const zoneOf = new Map((await repo.assignments(db)).map((a) => [a.cityId, a.zoneId]))
      return {
        items: rows.map((c) => {
          const m = method.get(zoneOf.get(c.id) ?? '')
          return {
            id: c.id, name: c.name, province: c.province, aliases: /** @type {string[] | null} */ (c.aliases) ?? [], isMajor: c.isMajor,
            ...(m ? { delivery: { fee: money(m.feeMinor), ...(m.freeAboveMinor === null ? {} : { freeAbove: money(m.freeAboveMinor) }), etaMinDays: m.etaMinDays, etaMaxDays: m.etaMaxDays } } : {}),
          }
        }),
      }
    },

    /** Numbers for the storefront configuration and the page tokens. */
    async facts() {
      const { enabled, cheapest } = await cheapestPerZone()
      if (!cheapest.length) return {}
      const thresholds = enabled.flatMap((m) => (m.freeAboveMinor === null ? [] : [m.freeAboveMinor]))
      const freeAbove = thresholds.length ? Math.min(...thresholds) : undefined
      const fee = Math.min(...cheapest.map((m) => m.feeMinor))
      return {
        ...(freeAbove === undefined ? {} : { freeAboveFrom: money(freeAbove), freeAbove: rs(freeAbove) }),
        defaultEta: { minDays: Math.min(...cheapest.map((m) => m.etaMinDays)), maxDays: Math.max(...cheapest.map((m) => m.etaMaxDays)) },
        codAvailable: cheapest.some((m) => m.codAllowed),
        fee: rs(fee),
      }
    },

    /** A courier, for a dispatch. @param {import('../../platform/db.js').Executor} x @param {string} id */
    courierById: (x, id) => repo.findCourier(x, id),

    /** The name of a city, for an order's snapshot. @param {import('../../platform/db.js').Executor} x @param {string} id */
    async cityName(x, id) {
      return (await repo.findCity(x, id))?.name
    },

    /**
     * The lowest free-delivery threshold any served zone offers: what a bag with no city yet is measured against ("add Rs 1,200 more for free delivery"). Reads through `x`.
     * @param {import('../../platform/db.js').Executor} x
     * @returns {Promise<number | undefined>} paisa
     */
    async freeAboveFrom(x) {
      const [methods, assigned] = await Promise.all([repo.methodsOf(x), repo.assignments(x)])
      const served = new Set(assigned.map((a) => a.zoneId))
      const thresholds = methods.flatMap((m) => (m.enabled && served.has(m.zoneId) && m.freeAboveMinor !== null ? [m.freeAboveMinor] : []))
      return thresholds.length ? Math.min(...thresholds) : undefined
    },

    /**
     * Every way to deliver to a city, with the raw fee and threshold: the cart prices them against its own total.
     * @param {import('../../platform/db.js').Executor} x @param {string} cityId
     */
    async deliveryOptions(x, cityId) {
      const zone = await repo.zoneOfCity(x, cityId)
      if (!zone || !zone.methods.length) throw new DomainError('city_not_served')
      return zone.methods.map((m) => ({ methodId: m.id, label: m.label, feeMinor: m.feeMinor, freeAboveMinor: m.freeAboveMinor, etaMinDays: m.etaMinDays, etaMaxDays: m.etaMaxDays, codAllowed: m.codAllowed }))
    },

    /**
     * The delivery fee for a city (ADR-0020 section 3): the chosen method of its zone, or the cheapest; free at or above the method's threshold.
     * @param {import('../../platform/db.js').Executor} x
     * @param {{ cityId: string, methodId?: string, amountAfterDiscount: number }} q paisa
     */
    async quote(x, { cityId, methodId, amountAfterDiscount }) {
      const zone = await repo.zoneOfCity(x, cityId)
      if (!zone || !zone.methods.length) throw new DomainError('city_not_served')
      const method = methodId ? zone.methods.find((m) => m.id === methodId) : zone.methods[0]
      if (!method) throw new DomainError('city_not_served') // a method that is not offered in this city
      const free = method.freeAboveMinor !== null && amountAfterDiscount >= method.freeAboveMinor
      return {
        zoneId: zone.zoneId,
        methodId: method.id,
        label: method.label,
        fee: money(free ? 0 : method.feeMinor),
        freeApplied: free,
        etaMinDays: method.etaMinDays,
        etaMaxDays: method.etaMaxDays,
        codAllowed: method.codAllowed,
      }
    },
  }
}

/** @typedef {typeof import('../../db/schema/shipping.js').couriers.$inferSelect} CourierRow */
/** @param {CourierRow} c */
const toCourier = (c) => ({ id: c.id, name: c.name, ...(c.trackingUrlPattern ? { trackingUrlPattern: c.trackingUrlPattern } : {}), trackingRequired: c.trackingRequired, enabled: c.enabled, sortOrder: c.sortOrder })
/** @param {{ name: string, trackingUrlPattern?: string, trackingRequired: boolean, enabled: boolean, sortOrder?: number }} c */
const courierDoc = (c) => ({ name: c.name, trackingUrlPattern: c.trackingUrlPattern ?? null, trackingRequired: c.trackingRequired, enabled: c.enabled, sortOrder: c.sortOrder ?? null })
