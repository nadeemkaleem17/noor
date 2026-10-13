// "Is the shop ready to open?" (plan/16-roadmap.md M7-05, DOC-14 section 5.2). What the base seed cannot know (the shop's own telephone number, its return days, whether the
// delivery fees are real) is checked here against the database, so a launch does not depend on somebody remembering. `pnpm --filter @noor/api cli launch:check`.
import { count, eq } from 'drizzle-orm'
import { products } from './db/schema/products.js'
import { shippingZones } from './db/schema/shipping.js'
import { staffUsers } from './db/schema/auth.js'
import { requiredPages } from './seed/pages.js'

/** The words the base seed puts in a zone's name until somebody has confirmed its fees (seed/base.js). */
export const PLACEHOLDER_ZONE = 'review fees before launch'
/** The account the local seed makes: it must not exist on a shop that is open. */
export const LOCAL_OWNER = 'owner@rubaya.test'

/**
 * @typedef {object} LaunchFacts
 * @property {{ phone?: string, whatsapp?: string, email?: string, address?: string }} contact
 * @property {number | undefined} returnsDays
 * @property {boolean} hasLogo
 * @property {string[]} paymentTypes enabled payment methods
 * @property {string[]} activePages slugs
 * @property {string[]} zoneNames
 * @property {boolean} deliveryFeesKnown at least one enabled delivery method
 * @property {number} liveProducts
 * @property {string[]} staffEmails
 * @property {string} appEnv
 */

/**
 * @param {LaunchFacts} f
 * @returns {{ level: 'blocker' | 'advice', where: string, what: string }[]} what stands between this shop and opening, most important first
 */
export function launchProblems(f) {
  /** @type {{ level: 'blocker' | 'advice', where: string, what: string }[]} */
  const out = []
  const blocker = (/** @type {string} */ where, /** @type {string} */ what) => out.push({ level: 'blocker', where, what })
  const advice = (/** @type {string} */ where, /** @type {string} */ what) => out.push({ level: 'advice', where, what })

  for (const [key, label] of /** @type {const} */ ([['phone', 'telephone number'], ['whatsapp', 'WhatsApp number'], ['email', 'email address'], ['address', 'address']])) {
    if (!f.contact[key]) blocker('Settings, Store, Contact', `the shop's ${label} is empty: the Contact, Privacy and Terms pages, the footer and the order page print it`)
  }
  if (f.returnsDays === undefined) blocker('Settings, Store, Policies', 'the number of days a customer may return an item is not set: the Shipping & returns page prints it')
  if (!f.deliveryFeesKnown) blocker('Settings, Shipping', 'no delivery method is switched on: a customer cannot check out, and the Shipping & returns page has no fee to print')
  for (const name of f.zoneNames.filter((n) => n.includes(PLACEHOLDER_ZONE))) blocker('Settings, Shipping', `the fees of "${name}" are the seed's placeholders: confirm them, then take the words "(${PLACEHOLDER_ZONE})" out of the name`)
  if (!f.paymentTypes.includes('cod')) blocker('Settings, Payments', 'cash on delivery is switched off, and it is the only way to pay at launch')
  for (const slug of requiredPages.filter((p) => p.locked).map((p) => p.slug)) {
    if (!f.activePages.includes(slug)) blocker('Content, Pages', `the page "${slug}" is not published`)
  }
  if (f.liveProducts === 0) blocker('Products', 'no product is published')
  if (f.staffEmails.includes(LOCAL_OWNER) && f.appEnv !== 'local') blocker('Settings, Staff', `the local development account ${LOCAL_OWNER} exists: deactivate it, and sign in as the real owner`)

  if (!f.hasLogo) advice('Settings, Store, Brand', 'no logo: the shop shows its name in text')
  return out
}

/**
 * Reads the facts from a running shop.
 * @param {{ db: import('./platform/db.js').Database['db'], settings: { storeConfig: () => Promise<any>, listPublicPages: () => Promise<{ items: { slug: string }[] }> }, shipping: { facts: () => Promise<{ fee?: string }> } }} deps
 * @param {string} appEnv
 * @returns {Promise<LaunchFacts>}
 */
export async function collectFacts({ db, settings, shipping }, appEnv) {
  const [config, pages, facts, zones, live, staff] = await Promise.all([
    settings.storeConfig(),
    settings.listPublicPages(),
    shipping.facts(),
    db.select({ name: shippingZones.name }).from(shippingZones),
    db.select({ n: count() }).from(products).where(eq(products.status, 'active')),
    db.select({ email: staffUsers.email }).from(staffUsers),
  ])
  return {
    contact: { phone: config.contact.phone, whatsapp: config.contact.whatsapp, email: config.contact.email, address: config.contact.address },
    returnsDays: config.policies.returnsDays,
    hasLogo: Boolean(config.brand.logoLight || config.brand.logoDark),
    paymentTypes: config.payments.map((/** @type {{ type: string }} */ m) => m.type),
    activePages: pages.items.map((p) => p.slug),
    zoneNames: zones.map((z) => z.name),
    deliveryFeesKnown: facts.fee !== undefined,
    liveProducts: live[0]?.n ?? 0,
    staffEmails: staff.map((s) => s.email),
    appEnv,
  }
}
