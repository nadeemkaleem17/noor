// The launch rules (src/launch.js) and the drafted pages (src/seed/pages.js), without a database.
import { describe, expect, it } from 'vitest'
import { launchProblems, LOCAL_OWNER, PLACEHOLDER_ZONE } from '../src/launch.js'
import { resolveTokens } from '../src/modules/settings/tokens.js'
import { requiredPages } from '../src/seed/pages.js'

/** A shop that is ready, which each test spoils in one way. @type {import('../src/launch.js').LaunchFacts} */
const ready = {
  contact: { phone: '+92 42 111 000 111', whatsapp: '923001112223', email: 'help@rubaya.pk', address: 'Shop 4, Liberty Market, Lahore' },
  returnsDays: 7,
  hasLogo: true,
  paymentTypes: ['cod'],
  activePages: requiredPages.map((p) => p.slug),
  zoneNames: ['Major cities'],
  deliveryFeesKnown: true,
  liveProducts: 12,
  staffEmails: ['owner@rubaya.pk'],
  appEnv: 'production',
}
const what = (/** @type {Partial<import('../src/launch.js').LaunchFacts>} */ spoil) => launchProblems({ ...ready, ...spoil }).map((p) => `${p.level}: ${p.where}`)

describe('launchProblems', () => {
  it('has nothing to say about a shop that is ready', () => {
    expect(launchProblems(ready)).toEqual([])
  })
  it('names each thing that is missing, and where to put it', () => {
    expect(what({ contact: { ...ready.contact, phone: '' } })).toEqual(['blocker: Settings, Store, Contact'])
    expect(what({ contact: {} })).toHaveLength(4)
    expect(what({ returnsDays: undefined })).toEqual(['blocker: Settings, Store, Policies'])
    expect(what({ deliveryFeesKnown: false })).toEqual(['blocker: Settings, Shipping'])
    expect(what({ zoneNames: [`Major cities (${PLACEHOLDER_ZONE})`] })).toEqual(['blocker: Settings, Shipping'])
    expect(what({ paymentTypes: [] })).toEqual(['blocker: Settings, Payments'])
    expect(what({ activePages: ['contact', 'terms', 'privacy'] })).toEqual(['blocker: Content, Pages'])
    expect(what({ liveProducts: 0 })).toEqual(['blocker: Products'])
  })
  it('puts a missing logo as advice, and the local owner as a blocker only off the local machine', () => {
    expect(what({ hasLogo: false })).toEqual(['advice: Settings, Store, Brand'])
    expect(what({ staffEmails: [LOCAL_OWNER] })).toEqual(['blocker: Settings, Staff'])
    expect(what({ staffEmails: [LOCAL_OWNER], appEnv: 'local' })).toEqual([])
  })
})

describe('the drafted pages', () => {
  const store = { contact: { phone: 'P', whatsapp: 'W', email: 'E', address: 'A', socials: [] }, policies: { returnsDays: 7 } }
  const facts = { fee: 'Rs. 250', freeAbove: 'Rs. 5,000', table: '- **Everywhere:** Rs. 250, 3 to 5 days' }

  it('use only tokens the shop knows, so that none is left empty once the settings are filled in', () => {
    for (const page of requiredPages) {
      const text = resolveTokens(page.bodyMd, /** @type {never} */ (store), facts)
      expect(text, page.slug).not.toContain('{{')
      for (const [, name] of page.bodyMd.matchAll(/\{\{\s*([A-Za-z]+\.[A-Za-z]+)\s*\}\}/g)) {
        expect(['store.phone', 'store.email', 'store.whatsapp', 'store.address', 'shipping.freeAbove', 'shipping.fee', 'shipping.table', 'returns.days'], `${page.slug}: ${name}`).toContain(name)
      }
    }
  })
  it('link only to pages that exist', () => {
    const slugs = new Set(requiredPages.map((p) => p.slug))
    for (const page of requiredPages) {
      for (const [, path] of page.bodyMd.matchAll(/\]\((\/[^)]*)\)/g)) {
        expect(path === '/track' || slugs.has(/** @type {string} */ (path).replace('/pages/', '')), `${page.slug}: ${path}`).toBe(true)
      }
    }
  })
  it('keep the four locked pages that the footer and the checkout point to', () => {
    expect(requiredPages.filter((p) => p.locked).map((p) => p.slug).sort()).toEqual(['contact', 'privacy', 'shipping-returns', 'terms'])
  })
})

describe('a WhatsApp number on a page', () => {
  it('is printed as a person reads it', () => {
    const at = (/** @type {string | undefined} */ whatsapp) => resolveTokens('{{store.whatsapp}}', /** @type {never} */ ({ contact: { whatsapp, socials: [] }, policies: {} }), {})
    expect(at('923001234567')).toBe('+92 300 1234567')
    expect(at('03001234567')).toBe('03001234567')
    expect(at(undefined)).toBe('')
  })
})
