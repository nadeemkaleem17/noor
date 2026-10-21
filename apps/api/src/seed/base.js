// Base seed (plan/14-devops.md section 5.2): what a shop needs to exist, safe to run on every environment and any number of times.
// Each piece is inserted only when it is missing, so staff edits are never overwritten.
import { defaultHighlightRules } from '@noor/contract'
import { now } from '../platform/clock.js'
import { ensureCounter } from '../platform/counters.js'
import { uuidv7 } from '../platform/ids.js'
import { menus, pages, settings } from '../db/schema/content.js'
import { customerHighlightRules } from '../db/schema/visits.js'
import { shippingZones } from '../db/schema/shipping.js'
import { sizeSystemValues, sizeSystems } from '../db/schema/taxonomy.js'
import { defaults } from '../modules/settings/defaults.js'
import * as shippingRepo from '../modules/shipping/repository.js'
import { seedShipping } from '../modules/shipping/index.js'
import { requiredPages } from './pages.js'

/** @typedef {import('../platform/db.js').Database['db']} Db */

const MAJOR = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Hyderabad', 'Quetta', 'Gujranwala', 'Sialkot']
const REVIEW = ' (review fees before launch)'

/** Size systems every shop starts with. */
export const baseSizeSystems = [
  { name: "Women's stitched", labels: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  { name: 'Footwear EU', labels: ['36', '37', '38', '39', '40', '41'] },
]

/**
 * @param {Db} db
 * @param {{ search: { seedSynonyms: () => Promise<number> } }} deps
 * @returns {Promise<Record<string, number>>} how many of each thing this run added
 */
export async function seedBase(db, { search }) {
  const at = now()
  /** @type {Record<string, number>} */
  const done = {}

  // numbers: orders start at 10001, invoices of this year at 1
  await ensureCounter(db, 'order_number', 10_000)
  await ensureCounter(db, `invoice_${at.getUTCFullYear()}`, 0)

  // the five documents, as the schema defaults say (the first save in the admin continues from version 1)
  const have = new Set((await db.select({ key: settings.key }).from(settings)).map((s) => s.key))
  const docs = /** @type {const} */ (['store', 'theme', 'home', 'payments', 'checkout']).filter((k) => !have.has(k))
  for (const key of docs) await db.insert(settings).values({ key, value: defaults[key], version: 1, updatedAt: at })
  done.settings = docs.length

  // the colours of Customers: written once, when there are none; a shop that deleted every rule would get them back from a later run of the seed
  const haveRules = (await db.select({ id: customerHighlightRules.id }).from(customerHighlightRules).limit(1)).length
  done.highlightRules = 0
  if (!haveRules) {
    for (const r of defaultHighlightRules) await db.insert(customerHighlightRules).values({ id: uuidv7(), ...r, enabled: true, createdAt: at, updatedAt: at })
    done.highlightRules = defaultHighlightRules.length
  }

  // menus
  const haveMenus = new Set((await db.select({ h: menus.handle }).from(menus)).map((m) => m.h))
  const menuItems = {
    // no `main` menu: the navigation bar is built from the categories and collections (Store setting 'Navigation bar': automatic), and staff write one only if they choose 'custom'
    footer: requiredPages.map((p) => ({ id: p.slug, label: p.title, href: `/pages/${p.slug}` })),
  }
  for (const [handle, items] of Object.entries(menuItems)) if (!haveMenus.has(handle)) await db.insert(menus).values({ handle, items, version: 1, updatedAt: at })

  // pages: the four required ones are locked (cannot be deleted, drafted or re-slugged)
  const havePages = new Set((await db.select({ s: pages.slug }).from(pages)).map((p) => p.s))
  done.pages = 0
  for (const p of requiredPages.filter((x) => !havePages.has(x.slug))) {
    await db.insert(pages).values({ id: uuidv7(), slug: p.slug, title: p.title, bodyMd: p.bodyMd, status: 'active', locked: p.locked, version: 1, createdAt: at, updatedAt: at })
    done.pages += 1
  }

  // cities and couriers
  Object.assign(done, await seedShipping(db))

  // two zones with placeholder fees, only on a shop that has none
  done.zones = 0
  if (!(await db.select({ id: shippingZones.id }).from(shippingZones).limit(1)).length) {
    const all = await shippingRepo.citiesByIds(db)
    const zone = async (/** @type {string} */ name, /** @type {number} */ order, /** @type {{ id: string }[]} */ cities, /** @type {{ fee: number, freeAbove: number, min: number, max: number }} */ m) => {
      const id = uuidv7()
      await shippingRepo.insertZone(db, { id, name: name + REVIEW, sortOrder: order, version: 1, createdAt: at, updatedAt: at })
      await shippingRepo.assign(db, id, cities.map((c) => c.id))
      await shippingRepo.insertMethod(db, { id: uuidv7(), zoneId: id, label: 'Standard delivery', feeMinor: m.fee * 100, freeAboveMinor: m.freeAbove * 100, etaMinDays: m.min, etaMaxDays: m.max, codAllowed: true, enabled: true, sortOrder: 0, i18n: null, createdAt: at, updatedAt: at })
    }
    await zone('Major cities', 0, all.filter((c) => MAJOR.includes(c.name)), { fee: 250, freeAbove: 5000, min: 3, max: 5 })
    await zone('Rest of Pakistan', 1, all.filter((c) => !MAJOR.includes(c.name)), { fee: 350, freeAbove: 8000, min: 4, max: 7 })
    done.zones = 2
  }

  // size systems
  const haveSystems = new Set((await db.select({ n: sizeSystems.name }).from(sizeSystems)).map((s) => s.n))
  done.sizeSystems = 0
  for (const sys of baseSizeSystems.filter((s) => !haveSystems.has(s.name))) {
    const id = uuidv7()
    await db.insert(sizeSystems).values({ id, name: sys.name, createdAt: at, updatedAt: at })
    await db.insert(sizeSystemValues).values(sys.labels.map((label, i) => ({ id: uuidv7(), sizeSystemId: id, label, sortOrder: i })))
    done.sizeSystems += 1
  }

  done.synonyms = await search.seedSynonyms()
  return done
}
