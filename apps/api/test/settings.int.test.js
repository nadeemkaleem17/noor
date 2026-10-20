// M1-06: settings documents, pages, menus and the public store/content reads, through HTTP on a scratch database.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { themePresets } from '@noor/contract'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { menus, pageRedirects, pages, settings } from '../src/db/schema/content.js'
import { media } from '../src/db/schema/media.js'
import { outboxEvents } from '../src/db/schema/platform.js'
import { setClock } from '../src/platform/clock.js'
import { uuidv7 } from '../src/platform/ids.js'
import { resolveTokens } from '../src/modules/settings/tokens.js'
import { defaults } from '../src/modules/settings/defaults.js'
import { app, closeHarness, createHarness, signedIn, t } from './support/staff.js'
import { dbAvailable } from './support/db.js'

/** A ready image row (no file needed: the responses are built from the row). */
async function readyMedia(width = 2000, height = 1500) {
  const id = uuidv7()
  await t.db.insert(media).values({ id, kind: 'image', status: 'ready', objectKey: `media/2026/10/${id}.jpg`, contentType: 'image/jpeg', bytes: 1000, width, height, alt: '', lqip: 'data:image/webp;base64,AAAA', createdAt: new Date() })
  return id
}
const PAGE = { title: 'About us', slug: 'about', bodyMd: 'We are Rubaya.', status: /** @type {const} */ ('active') }
const publicGet = (/** @type {string} */ url) => app.inject({ url: `/api/v1${url}`, remoteAddress: '10.20.30.40' })

describe.skipIf(!dbAvailable)('settings, pages and menus (MySQL, through HTTP)', () => {
  beforeAll(createHarness, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    setClock(null)
    await t.migrate.db.delete(auditLog)
    await t.db.delete(outboxEvents)
    await t.db.delete(pageRedirects)
    await t.db.delete(pages)
    await t.db.delete(menus)
    await t.db.delete(settings)
    await t.db.delete(media)
    await t.db.delete(staffUsers)
  })

  describe('tokens', () => {
    const store = { ...defaults.store, contact: { socials: [], phone: '0300 1234567', email: 'hi@rubaya.pk' }, policies: { returnsDays: 7 } }
    it('are replaced from settings; unknown ones and missing values become nothing', () => {
      expect(resolveTokens('Call {{store.phone}} or {{ store.email }}. Returns in {{returns.days}} days. {{shipping.fee}}|{{store.address}}|{{nope.x}}', store, {})).toBe('Call 0300 1234567 or hi@rubaya.pk. Returns in 7 days. ||')
      expect(resolveTokens('Free above {{shipping.freeAbove}}', store, { freeAbove: 'Rs. 3,000' })).toBe('Free above Rs. 3,000')
    })
  })

  describe('documents', () => {
    it('read as their defaults, version 0, before anyone saves them', async () => {
      const { b } = await signedIn('owner')
      for (const [key, url] of /** @type {const} */ ([['store', '/admin/settings/store'], ['theme', '/admin/settings/theme'], ['checkout', '/admin/settings/checkout'], ['payments', '/admin/settings/payments'], ['home', '/admin/content/home']])) {
        const r = await b.call('GET', url)
        expect(r.status, key).toBe(200)
        expect(r.body).toMatchObject({ value: defaults[key], version: 0, images: {} })
        expect(r.body.updatedAt).toBeUndefined()
      }
      expect((await b.call('GET', '/admin/settings/store')).body.value.brand.name).toBe('Rubaya')
    }, 60_000)

    it('saves with the version, refuses a stale one, and audits only the fields that changed', async () => {
      const { b } = await signedIn('owner')
      const value = { ...defaults.store, brand: { name: 'Rubaya Atelier' }, contact: { socials: [], phone: '0300 1112223' } }
      const first = await b.call('PUT', '/admin/settings/store', { body: { value, version: 0 } })
      expect(first.status, JSON.stringify(first.body)).toBe(200)
      expect(first.body).toMatchObject({ version: 1, value: { brand: { name: 'Rubaya Atelier' } }, updatedBy: expect.any(String) })
      const stale = await b.call('PUT', '/admin/settings/store', { body: { value, version: 0 } })
      expect([stale.status, stale.body.code, stale.body.currentVersion]).toEqual([409, 'stale_write', 1])
      const again = await b.call('PUT', '/admin/settings/store', { body: { value: { ...value, seo: { homeDescription: 'Pakistani fashion' } }, version: 1 } })
      expect(again.body.version).toBe(2)
      const entries = (await t.db.select().from(auditLog)).filter((e) => e.action === 'settings.updated')
      expect(entries).toHaveLength(2)
      expect(entries.find((e) => e.diff && 'seo.homeDescription' in /** @type {object} */ (e.diff))?.diff).toEqual({ 'seo.homeDescription': [undefined, 'Pakistani fashion'].map((x) => x ?? null) })
      expect(entries.find((e) => e.diff && 'brand.name' in /** @type {object} */ (e.diff))?.diff).toMatchObject({ 'brand.name': ['Rubaya', 'Rubaya Atelier'], 'contact.phone': [null, '0300 1112223'] })
      const events = await t.db.select().from(outboxEvents)
      expect(events.map((e) => [e.type, e.payload])).toContainEqual(['settings.updated', { key: 'store', tags: ['store-config'] }])
    }, 60_000)

    it('rejects values the schema or the rules refuse, naming the field', async () => {
      const { b } = await signedIn('owner')
      const put = (/** @type {object} */ patch) => b.call('PUT', '/admin/settings/store', { body: { value: { ...defaults.store, ...patch }, version: 0 } })
      expect((await put({ contact: { socials: [], whatsapp: '0300-1234' } })).body.issues).toEqual([{ path: 'value.contact.whatsapp', code: 'phone_invalid' }])
      expect((await put({ contact: { socials: [], mapUrl: 'http://maps.example/x' } })).body.issues).toEqual([{ path: 'value.contact.mapUrl', code: 'link_invalid' }])
      expect((await put({ contact: { socials: [{ platform: 'instagram', url: 'javascript:alert(1)' }] } })).body.issues).toEqual([{ path: 'value.contact.socials.0.url', code: 'link_invalid' }])
      expect((await put({ orderNumberPrefix: 'rb1' })).body.issues).toEqual([{ path: 'value.orderNumberPrefix', code: 'code_invalid' }])
      expect((await put({ locale: { default: 'ur', supported: ['en'] } })).status).toBe(400)
      expect((await put({ unknown: 1 })).body.issues).toEqual([{ path: 'value.unknown', code: 'unrecognized_keys' }])
      const missing = await put({ brand: { name: 'X', logoLightMediaId: uuidv7() } })
      expect([missing.status, missing.body.code]).toEqual([409, 'media_not_ready'])
    }, 60_000)

    it('shows the preview of a logo next to its media id', async () => {
      const { b } = await signedIn('owner')
      const logo = await readyMedia(400, 200)
      const r = await b.call('PUT', '/admin/settings/store', { body: { value: { ...defaults.store, brand: { name: 'Rubaya', logoLightMediaId: logo } }, version: 0 } })
      expect(r.status, JSON.stringify(r.body)).toBe(200)
      expect(r.body.images[logo]).toMatchObject({ width: 400, height: 200 })
    }, 60_000)

    it('refuses a theme that fails the contrast gate, with the failing pairs, even though the UI would have caught it', async () => {
      const { b } = await signedIn('owner')
      const faint = { ...themePresets['storefront-gold'], colors: { ...themePresets['storefront-gold'].colors, fg: '#DDDDDD' } }
      const r = await b.call('PUT', '/admin/settings/theme', { body: { value: faint, version: 0 } })
      expect([r.status, r.body.code]).toEqual([422, 'theme_contrast_failed'])
      expect(r.body.pairs).toContainEqual({ pair: 'fg/bg', ratio: expect.any(Number), min: 4.5 })
      const ok = await b.call('PUT', '/admin/settings/theme', { body: { value: themePresets.monochrome, version: 0 } })
      expect(ok.status).toBe(200)
      expect((await publicGet('/store/config')).json().theme).toEqual(themePresets.monochrome)
      const presets = (await b.call('GET', '/admin/settings/theme/presets')).body.items.map((/** @type {{ id: string }} */ p) => p.id)
      expect(presets.sort()).toEqual(Object.keys(themePresets).sort())
    }, 60_000)

    it('needs one enabled payment method, bank details when bank transfer is on, and keeps account numbers out of the trail and the storefront', async () => {
      const { b } = await signedIn('owner')
      const methods = (/** @type {object[]} */ list) => ({ methods: list })
      const cod = { type: 'cod', enabled: true, label: 'Cash on delivery', sortOrder: 0 }
      const bank = { type: 'bank_transfer', enabled: true, label: 'Bank transfer', sortOrder: 1 }
      const none = await b.call('PUT', '/admin/settings/payments', { body: { value: methods([{ ...cod, enabled: false }]), version: 0 } })
      expect([none.status, none.body.code]).toEqual([422, 'no_payment_method'])
      const noDetails = await b.call('PUT', '/admin/settings/payments', { body: { value: methods([cod, bank]), version: 0 } })
      expect([noDetails.status, noDetails.body.issues]).toEqual([400, [{ path: 'bankTransfer', code: 'required' }]])
      const details = { accountTitle: 'Rubaya Pvt', bank: 'HBL', accountNumber: 'PK36HABB0000123456789', instructions: 'Send the receipt' }
      const ok = await b.call('PUT', '/admin/settings/payments', { body: { value: { ...methods([cod, bank]), bankTransfer: details, codLimitMinor: 5_000_000 }, version: 0 } })
      expect(ok.status, JSON.stringify(ok.body)).toBe(200)
      expect(ok.body.adapters).toEqual([{ type: 'cod', configured: true }, { type: 'bank_transfer', configured: true }, { type: 'wallet', configured: false }, { type: 'card', configured: false }, { type: 'bnpl', configured: false }])
      const entry = (await t.db.select().from(auditLog)).find((e) => e.action === 'settings.updated')
      expect(JSON.stringify(entry?.diff)).not.toContain('PK36HABB')
      expect(entry?.category).toBe('money')
      const config = await publicGet('/store/config')
      expect(config.json().payments.map((/** @type {{ type: string }} */ p) => p.type)).toEqual(['cod', 'bank_transfer'])
      expect(config.body).not.toContain('PK36HABB')
      expect(config.body).not.toContain('codLimit')
    }, 60_000)

    it('allows at most three extra checkout fields and none that reuse a fixed field', async () => {
      const { b } = await signedIn('owner')
      const field = (/** @type {string} */ key) => ({ key, label: key, type: 'text', required: false })
      const put = (/** @type {object[]} */ extraFields) => b.call('PUT', '/admin/settings/checkout', { body: { value: { extraFields, marketingConsent: { enabled: false, label: '' } }, version: 0 } })
      expect((await put([field('a'), field('b'), field('c'), field('d')])).status).toBe(400)
      expect((await put([field('phone')])).status).toBe(400)
      expect((await put([field('a'), field('a')])).status).toBe(400)
      expect((await put([field('occasion')])).status).toBe(200)
      expect((await publicGet('/store/config')).json().checkout.extraFields).toHaveLength(1)
    }, 60_000)
  })

  describe('public store configuration', () => {
    it('is cacheable by everyone, carries no staff data, and reads the same without a session', async () => {
      const { b } = await signedIn('owner')
      await b.call('PUT', '/admin/settings/store', {
        body: { value: { ...defaults.store, notifications: { staffEmails: ['boss@rubaya.pk'] }, thresholds: { lowStock: 9, highValueCodMinor: 1 }, contact: { socials: [], phone: '0300 1' }, dispatchPromise: 'Ships in 2 days' }, version: 0 },
      })
      const r = await publicGet('/store/config')
      expect(r.statusCode).toBe(200)
      expect(r.headers['cache-control']).toBe('public, s-maxage=60, stale-while-revalidate=600')
      const text = r.body
      for (const hidden of ['boss@rubaya.pk', 'staffEmails', 'thresholds', 'highValueCod', 'lowStock', 'orderNumberPrefix', 'notifications']) expect(text, hidden).not.toContain(hidden)
      expect(r.json()).toMatchObject({ brand: { name: 'Rubaya' }, contact: { phone: '0300 1', socials: [] }, shipping: { dispatchPromise: 'Ships in 2 days' }, environment: 'local', locale: { default: 'en', supported: ['en'] } })
      expect((await publicGet('/store/config?locale=fr')).statusCode).toBe(400)
    }, 60_000)
  })

  describe('home content', () => {
    const base = () => /** @type {any} */ (structuredClone(defaults.home))

    it('shows only what is live: notices inside their window, enabled bands with a heading, slides with a ready picture', async () => {
      setClock(new Date('2026-10-10T10:00:00.000Z'))
      const { b } = await signedIn('manager')
      const hero = await readyMedia()
      const value = base()
      value.announcement = { text: 'Eid sale', href: '/sale' }
      value.notices = [
        { id: 'now', text: 'Live', severity: 'info', startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-10-31T00:00:00.000Z' },
        { id: 'past', text: 'Over', severity: 'info', endsAt: '2026-10-05T00:00:00.000Z' },
        { id: 'future', text: 'Soon', severity: 'promo', startsAt: '2026-11-01T00:00:00.000Z' },
        { id: 'always', text: 'Always', severity: 'notice' },
      ]
      value.heroSlides = [{ id: 's1', mediaId: hero, alt: 'Model in green', heading: 'New season', buttonText: 'Shop', buttonHref: '/new' }]
      value.promo = { enabled: false, heading: 'Hidden', buttonText: 'Go', buttonHref: '/sale' }
      value.editorial = { enabled: true, heading: 'Our story', text: 'Made with care' }
      value.footer = { about: 'Rubaya is a Pakistani label.' }
      const saved = await b.call('PUT', '/admin/content/home', { body: { value, version: 0 } })
      expect(saved.status, JSON.stringify(saved.body)).toBe(200)
      expect(saved.body.images[hero]).toMatchObject({ width: 2000 })
      const home = (await publicGet('/content/home')).json()
      expect(home.announcement).toEqual({ text: 'Eid sale', href: '/sale' })
      expect(home.notices.map((/** @type {{ id: string }} */ n) => n.id)).toEqual(['now', 'always'])
      expect(home.heroSlides[0]).toMatchObject({ id: 's1', heading: 'New season', buttonHref: '/new', image: { alt: 'Model in green', width: 2000 } })
      expect(home.promo).toBeUndefined()
      expect(home.editorial).toEqual({ heading: 'Our story', text: 'Made with care' })
      expect(home.footer).toEqual({ about: 'Rubaya is a Pakistani label.' })
      expect(JSON.stringify(home)).not.toContain('mediaId')
    }, 60_000)

    it('gives the shop a whole home layout: the default when never set, and the order staff chose with every section once', async () => {
      const { b } = await signedIn('manager')
      const before = (await publicGet('/content/home')).json()
      expect(before.layout.order).toEqual(['categories', 'newIn', 'collections', 'categoryBlocks', 'promo', 'bestsellers', 'editorial'])
      expect(before.layout.newIn).toEqual({ enabled: true, count: 8 })
      const value = base()
      value.layout = { order: ['newIn', 'editorial', 'newIn'], categories: { enabled: false, count: 4 }, newIn: { enabled: true, heading: 'Just landed', count: 6 }, collections: { enabled: true, count: 3 }, categoryBlocks: { enabled: true, count: 2 }, bestsellers: { enabled: false, count: 8 } }
      const saved = await b.call('PUT', '/admin/content/home', { body: { value, version: 0 } })
      expect(saved.status, JSON.stringify(saved.body)).toBe(200)
      const home = (await publicGet('/content/home')).json()
      // a section listed twice counts once, and the ones left out follow in the usual order
      expect(home.layout.order).toEqual(['newIn', 'editorial', 'categories', 'collections', 'categoryBlocks', 'promo', 'bestsellers'])
      expect(home.layout).toMatchObject({ categories: { enabled: false, count: 4 }, newIn: { heading: 'Just landed', count: 6 }, bestsellers: { enabled: false } })
    }, 60_000)

    it('sends the shop its notices with place, colour and wording, leaves out the ones that are off, and fills in the old ones', async () => {
      const { b } = await signedIn('manager')
      const value = base()
      value.notices = [
        { id: 'old', text: 'An old notice', severity: 'info' },
        { id: 'pop', text: 'Eid sale', title: 'Eid sale', body: 'Up to 30% off.', buttonText: 'Shop', href: '/sale', severity: 'promo', position: 'popup', palette: 'warning', popupEvery: 'once' },
        { id: 'off', text: 'Switched off', severity: 'info', position: 'side', active: false },
      ]
      const saved = await b.call('PUT', '/admin/content/home', { body: { value, version: 0 } })
      expect(saved.status, JSON.stringify(saved.body)).toBe(200)
      const home = (await publicGet('/content/home')).json()
      expect(home.notices.map((/** @type {{ id: string }} */ n) => n.id)).toEqual(['old', 'pop'])
      expect(home.notices[0]).toEqual({ id: 'old', text: 'An old notice', severity: 'info', position: 'bar', palette: 'accent', popupEvery: 'day' })
      expect(home.notices[1]).toEqual({ id: 'pop', text: 'Eid sale', title: 'Eid sale', body: 'Up to 30% off.', buttonText: 'Shop', href: '/sale', severity: 'promo', position: 'popup', palette: 'warning', popupEvery: 'once' })
    }, 60_000)

    it('refuses a notice button without a link, an unknown colour or place, and more than ten notices', async () => {
      const { b } = await signedIn('manager')
      const n = (/** @type {number} */ i, /** @type {object} */ extra = {}) => ({ id: `n${i}`, text: 'Hello', severity: 'info', ...extra })
      const put = (/** @type {object[]} */ notices) => {
        const v = base()
        v.notices = notices
        return b.call('PUT', '/admin/content/home', { body: { value: v, version: 0 } })
      }
      expect((await put([n(1, { buttonText: 'Go' })])).status).toBe(400)
      expect((await put([n(1, { palette: 'hotpink' })])).status).toBe(400)
      expect((await put([n(1, { position: 'footer' })])).status).toBe(400)
      expect((await put(Array.from({ length: 11 }, (_, i) => n(i)))).status).toBe(400)
      expect((await put(Array.from({ length: 10 }, (_, i) => n(i)))).status).toBe(200)
    }, 60_000)

    it('refuses a section size outside what the shop can show', async () => {
      const { b } = await signedIn('manager')
      const value = base()
      value.layout = { order: [], categories: { enabled: true, count: 40 }, newIn: { enabled: true, count: 8 }, collections: { enabled: true, count: 3 }, categoryBlocks: { enabled: true, count: 6 }, bestsellers: { enabled: true, count: 2 } }
      const res = await b.call('PUT', '/admin/content/home', { body: { value, version: 0 } })
      expect(res.status).toBe(400)
      expect(res.body.issues.map((/** @type {{ path: string }} */ i) => i.path).sort()).toEqual(['value.layout.bestsellers.count', 'value.layout.categories.count'])
    })

    it('refuses a button with only half of its pair, a bad link, a media that is not ready, and too many slides', async () => {
      const { b } = await signedIn('manager')
      const hero = await readyMedia()
      const slide = (/** @type {number} */ i, /** @type {object} */ extra = {}) => ({ id: `s${i}`, mediaId: hero, alt: 'alt', heading: 'H', ...extra })
      const put = (/** @type {(v: any) => void} */ edit) => {
        const v = base()
        edit(v)
        return b.call('PUT', '/admin/content/home', { body: { value: v, version: 0 } })
      }
      expect((await put((v) => (v.heroSlides = [slide(1, { buttonHref: '/new' })]))).status).toBe(400)
      expect((await put((v) => (v.heroSlides = [slide(1, { buttonText: 'Go', buttonHref: 'javascript:alert(1)' })]))).status).toBe(400)
      expect((await put((v) => (v.heroSlides = [slide(1, { alt: '' })]))).status).toBe(400)
      expect((await put((v) => (v.heroSlides = Array.from({ length: 7 }, (_, i) => slide(i))))).status).toBe(400)
      expect((await put((v) => (v.notices = Array.from({ length: 11 }, (_, i) => ({ id: `n${i}`, text: 'x', severity: 'info' }))))).status).toBe(400)
      const gone = await put((v) => (v.heroSlides = [{ ...slide(1), mediaId: uuidv7() }]))
      expect([gone.status, gone.body.code]).toEqual([409, 'media_not_ready'])
    }, 60_000)

    it('serves the Urdu text when asked and falls back to English where it is missing', async () => {
      const { b } = await signedIn('manager')
      const value = base()
      value.announcement = { text: 'Sale' }
      value.notices = [{ id: 'a', text: 'Free delivery', severity: 'info' }, { id: 'b', text: 'Eid hours', severity: 'info' }]
      value.footer = { about: 'About' }
      value.i18n = { ur: { announcement: 'سیل', notices: { a: 'مفت ڈیلیوری' } } }
      await b.call('PUT', '/admin/content/home', { body: { value, version: 0 } })
      const ur = (await publicGet('/content/home?locale=ur')).json()
      expect(ur.announcement.text).toBe('سیل')
      expect(ur.notices.map((/** @type {{ text: string }} */ n) => n.text)).toEqual(['مفت ڈیلیوری', 'Eid hours'])
      expect(ur.footer.about).toBe('About')
      expect((await publicGet('/content/home')).json().announcement.text).toBe('Sale')
    }, 60_000)

    it('protects a picture a document uses from being deleted until it is removed from the document', async () => {
      const { b } = await signedIn('manager')
      const hero = await readyMedia()
      const value = base()
      value.heroSlides = [{ id: 's1', mediaId: hero, alt: 'alt', heading: 'H' }]
      await b.call('PUT', '/admin/content/home', { body: { value, version: 0 } })
      const blocked = await b.call('DELETE', `/admin/media/${hero}`)
      expect([blocked.status, blocked.body.code]).toEqual([409, 'in_use'])
      await b.call('PUT', '/admin/content/home', { body: { value: base(), version: 1 } })
      expect((await b.call('DELETE', `/admin/media/${hero}`)).status).toBe(204)
    }, 60_000)

    it('is not writable by roles without content:write', async () => {
      const { b } = await signedIn('support')
      expect((await b.call('PUT', '/admin/content/home', { body: { value: base(), version: 0 } })).status).toBe(403)
      expect((await b.call('GET', '/admin/content/home')).status).toBe(403)
    }, 60_000)
  })

  describe('pages', () => {
    it('are created, listed, edited with the version and deleted, each step audited', async () => {
      const { b } = await signedIn('manager')
      const created = await b.call('POST', '/admin/pages', { body: PAGE })
      expect(created.status, JSON.stringify(created.body)).toBe(201)
      expect(created.body).toMatchObject({ ...PAGE, locked: false, version: 1, storefrontUrl: '/pages/about' })
      const id = created.body.id
      expect((await b.call('POST', '/admin/pages', { body: PAGE })).body.code).toBe('slug_taken')
      const list = await b.call('GET', '/admin/pages?status=active&sort=title')
      expect(list.body).toMatchObject({ total: 1, page: 1, size: 50, items: [{ id, title: 'About us', slug: 'about', status: 'active', locked: false }] })
      expect((await b.call('GET', '/admin/pages?q=ab')).body.total).toBe(1)
      expect((await b.call('GET', '/admin/pages?q=zz')).body.total).toBe(0)
      expect((await b.call('GET', '/admin/pages?sort=bodyMd')).status).toBe(400)
      const edited = await b.call('PUT', `/admin/pages/${id}`, { body: { ...PAGE, bodyMd: 'New text', version: 1 } })
      expect(edited.body).toMatchObject({ bodyMd: 'New text', version: 2 })
      expect((await b.call('PUT', `/admin/pages/${id}`, { body: { ...PAGE, version: 1 } })).body.code).toBe('stale_write')
      expect((await b.call('DELETE', `/admin/pages/${id}`)).status).toBe(204)
      expect((await b.call('GET', `/admin/pages/${id}`)).status).toBe(404)
      const trail = (await t.db.select().from(auditLog)).filter((e) => e.entityType === 'page').map((e) => e.action).sort()
      expect(trail).toEqual(['page.created', 'page.deleted', 'page.updated'])
    }, 60_000)

    it('keep a locked page: no new slug, no draft, no delete', async () => {
      const { b } = await signedIn('manager')
      const id = uuidv7()
      await t.db.insert(pages).values({ id, slug: 'privacy', title: 'Privacy', bodyMd: 'p', status: 'active', locked: true, version: 1, createdAt: new Date(), updatedAt: new Date() })
      const body = { title: 'Privacy', slug: 'privacy', bodyMd: 'p2', status: 'active', version: 1 }
      expect((await b.call('PUT', `/admin/pages/${id}`, { body: { ...body, slug: 'privacy-policy' } })).body.code).toBe('page_locked')
      expect((await b.call('PUT', `/admin/pages/${id}`, { body: { ...body, status: 'draft' } })).body.code).toBe('page_locked')
      expect((await b.call('DELETE', `/admin/pages/${id}`)).body.code).toBe('page_locked')
      expect((await b.call('PUT', `/admin/pages/${id}`, { body })).status).toBe(200)
    }, 60_000)

    it('answer at the public URL only when active, resolve tokens, and fall back to English for Urdu', async () => {
      const { b } = await signedIn('manager')
      await b.call('PUT', '/admin/settings/store', { body: { value: { ...defaults.store, contact: { socials: [], phone: '0300 9998887' }, policies: { returnsDays: 7 } }, version: 0 } })
      const draft = await b.call('POST', '/admin/pages', { body: { ...PAGE, slug: 'secret', status: 'draft' } })
      expect((await publicGet('/content/pages/secret')).statusCode).toBe(404)
      await b.call('POST', '/admin/pages', { body: { ...PAGE, slug: 'contact', title: 'Contact', bodyMd: 'Call {{store.phone}}. Returns: {{returns.days}} days. {{unknown.token}}', seo: { title: 'Contact Rubaya' } } })
      const en = await publicGet('/content/pages/contact?locale=ur')
      expect(en.headers['cache-control']).toBe('public, s-maxage=60, stale-while-revalidate=600')
      expect(en.json()).toMatchObject({ slug: 'contact', title: 'Contact', bodyMd: 'Call 0300 9998887. Returns: 7 days. ', seo: { title: 'Contact Rubaya' }, locale: 'en' })
      const put = await b.call('PUT', `/admin/pages/${draft.body.id}`, { body: { ...PAGE, slug: 'secret', status: 'active', i18n: { ur: { title: 'خفیہ', bodyMd: 'متن {{store.phone}}' } }, version: 1 } })
      expect(put.status).toBe(200)
      expect((await publicGet('/content/pages/secret?locale=ur')).json()).toMatchObject({ title: 'خفیہ', bodyMd: 'متن 0300 9998887', locale: 'ur' })
      expect((await publicGet('/content/pages/secret')).json()).toMatchObject({ title: 'About us', locale: 'en' })
      expect((await publicGet('/content/pages')).json().items.map((/** @type {{ slug: string }} */ p) => p.slug).sort()).toEqual(['contact', 'secret'])
    }, 60_000)

    it('leave a redirect behind when the slug changes, and the old slug is free again for a new page', async () => {
      const { b } = await signedIn('manager')
      const p = await b.call('POST', '/admin/pages', { body: PAGE })
      await b.call('PUT', `/admin/pages/${p.body.id}`, { body: { ...PAGE, slug: 'our-story', version: 1 } })
      expect((await publicGet('/content/pages/about')).json()).toEqual({ redirectTo: '/pages/our-story' })
      expect((await publicGet('/content/pages/our-story')).statusCode).toBe(200)
      const reuse = await b.call('POST', '/admin/pages', { body: { ...PAGE, title: 'Different' } })
      expect(reuse.status).toBe(201)
      expect((await publicGet('/content/pages/about')).json()).toMatchObject({ title: 'Different' })
    }, 60_000)

    it('preview resolves tokens without saving anything, and the slug rule is enforced', async () => {
      const { b } = await signedIn('catalog')
      const r = await b.call('POST', '/admin/pages/preview', { body: { bodyMd: 'Hi {{store.email}}' } })
      expect(r.body).toEqual({ bodyMd: 'Hi ' })
      for (const slug of ['About', 'a b', '-x', 'x--y', 'x'.repeat(81), '']) expect((await b.call('POST', '/admin/pages', { body: { ...PAGE, slug } })).status, slug).toBe(400)
      expect((await b.call('POST', '/admin/pages', { body: { ...PAGE, bodyMd: 'x'.repeat(50_001) } })).status).toBe(400)
    }, 60_000)
  })

  describe('menus', () => {
    it('are saved whole with ids, checked for depth and size, and refuse links that are not links', async () => {
      const { b } = await signedIn('manager')
      const items = [{ label: 'New', href: '/new' }, { label: 'Women', href: '/c/women', children: [{ label: 'Unstitched', href: '/c/unstitched', i18n: { ur: { label: 'ان سلا' } } }] }]
      const ok = await b.call('PUT', '/admin/menus/main', { body: { items, version: 0 } })
      expect(ok.status, JSON.stringify(ok.body)).toBe(200)
      expect(ok.body).toMatchObject({ handle: 'main', version: 1 })
      const ids = [ok.body.items[0].id, ok.body.items[1].id, ok.body.items[1].children[0].id]
      expect(new Set(ids).size).toBe(3)
      expect(ok.body.items[1].children[0]).toMatchObject({ label: 'Unstitched', targetLive: true })
      const keep = await b.call('PUT', '/admin/menus/main', { body: { items: ok.body.items.map((/** @type {any} */ i) => ({ id: i.id, label: i.label, href: i.href })), version: 1 } })
      expect(keep.body.items.map((/** @type {{ id: string }} */ i) => i.id)).toEqual([ids[0], ids[1]])

      const deep = [{ label: 'A', href: '/new', children: [{ label: 'B', href: '/new', children: [{ label: 'C', href: '/new' }] }] }]
      expect((await b.call('PUT', '/admin/menus/main', { body: { items: deep, version: 2 } })).body.issues).toEqual([{ path: 'items.0.children.0.children', code: 'invalid_format' }])
      const nine = Array.from({ length: 9 }, (_, i) => ({ label: `L${i}`, href: '/new' }))
      expect((await b.call('PUT', '/admin/menus/main', { body: { items: nine, version: 2 } })).body.issues).toEqual([{ path: 'items', code: 'too_big' }])
      expect((await b.call('PUT', '/admin/menus/footer', { body: { items: [{ label: 'A', href: '/new', children: [{ label: 'B', href: '/new' }] }], version: 0 } })).body.issues).toEqual([{ path: 'items.0.children', code: 'invalid_format' }])
      expect((await b.call('PUT', '/admin/menus/main', { body: { items: [{ label: 'X', href: 'javascript:alert(1)' }], version: 2 } })).status).toBe(400)
      expect((await b.call('PUT', '/admin/menus/main', { body: { items: [{ id: 'dup', label: 'A', href: '/new' }, { id: 'dup', label: 'B', href: '/sale' }], version: 2 } })).body.issues).toEqual([{ path: 'items.1.id', code: 'not_unique' }])
      expect((await b.call('PUT', '/admin/menus/main', { body: { items, version: 0 } })).body.code).toBe('stale_write')
      expect((await b.call('GET', '/admin/menus/sidebar')).status).toBe(400)
    }, 60_000)

    it('mark items whose page is not live, and the storefront leaves them out; Urdu labels when asked', async () => {
      const { b } = await signedIn('manager')
      await b.call('POST', '/admin/pages', { body: { ...PAGE, slug: 'live', title: 'Live' } })
      await b.call('POST', '/admin/pages', { body: { ...PAGE, slug: 'hidden', title: 'Hidden', status: 'draft' } })
      const items = [
        { label: 'Live page', href: '/pages/live', i18n: { ur: { label: 'لائیو' } } },
        { label: 'Draft page', href: '/pages/hidden' },
        { label: 'Gone', href: '/nowhere' },
        { label: 'Outside', href: 'https://instagram.com/rubaya' },
        { label: 'Parent', href: '/pages/hidden', children: [{ label: 'Child', href: '/new' }] },
      ]
      const saved = await b.call('PUT', '/admin/menus/main', { body: { items, version: 0 } })
      expect(saved.body.items.map((/** @type {{ targetLive: boolean }} */ i) => i.targetLive)).toEqual([true, false, false, true, false])
      const pub = (await publicGet('/content/menus/main')).json()
      expect(pub.items.map((/** @type {{ label: string }} */ i) => i.label)).toEqual(['Live page', 'Outside'])
      expect(JSON.stringify(pub)).not.toContain('targetLive')
      expect((await publicGet('/content/menus/main?locale=ur')).json().items[0].label).toBe('لائیو')
      expect((await publicGet('/content/menus/footer')).json()).toEqual({ handle: 'footer', items: [] })
      expect((await publicGet('/content/menus/other')).statusCode).toBe(400)
    }, 60_000)

    it('link search offers fixed pages and active CMS pages', async () => {
      const { b } = await signedIn('catalog')
      await b.call('POST', '/admin/pages', { body: { ...PAGE, slug: 'size-help', title: 'Size help' } })
      await b.call('POST', '/admin/pages', { body: { ...PAGE, slug: 'size-draft', title: 'Size draft', status: 'draft' } })
      const r = await b.call('GET', '/admin/links?q=size')
      expect(r.body.items).toEqual([{ type: 'static', label: 'Size guide', href: '/size-guide' }, { type: 'page', label: 'Size help', href: '/pages/size-help' }])
      expect((await b.call('GET', '/admin/links?q=s')).status).toBe(400)
    }, 60_000)
  })

  it('reports how much of the interface exists in Urdu', async () => {
    const { b } = await signedIn('manager')
    const r = await b.call('GET', '/admin/settings/translation-status')
    expect(r.body.ui.total).toBeGreaterThan(20)
    expect(r.body.ui.translated).toBeLessThanOrEqual(r.body.ui.total)
    expect(r.body.products).toEqual({ total: 0, translated: 0 })
  }, 60_000)
})
