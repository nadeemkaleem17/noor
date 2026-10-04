// Settings documents, CMS pages and menus: the admin side (plan/10-api/07) and the public reads (plan/10-api/01).
// A document is validated by its schema in the contract and by the rules here, saved with an optimistic version, audited with a
// field-level diff, and announced on the outbox with the cache tags a CDN purge needs.
import { randomBytes } from 'node:crypto'
import { contrastFailures, CheckoutSettings, HomeContent, PaymentSettings, StoreSettings, ThemeTokens, menuLimits, themePresets } from '@noor/contract'
import { DomainError } from '../../platform/errors.js'
import { transaction } from '../../platform/db.js'
import { now } from '../../platform/clock.js'
import { uuidv7 } from '../../platform/ids.js'
import { emit } from '../../platform/outbox.js'
import { diffOf, record } from '../audit/index.js'
import { readyIds } from '../media/repository.js'
import { defaults } from './defaults.js'
import * as repo from './repository.js'
import { resolveTokens } from './tokens.js'
import { translationStatus as uiTranslationStatus } from './translation-status.js'

/**
 * @typedef {{ staffId: string, name: string, role: string }} Staff
 * @typedef {{ ip: string, userAgent: string, requestId: string }} RequestInfo
 * @typedef {'en' | 'ur'} Locale
 * @typedef {import('./tokens.js').ShippingFacts} ShippingFacts
 */

/** The five documents: what validates them, which storefront cache tags a change purges, how it is audited. */
const DOCS = /** @type {const} */ ({
  store: { schema: StoreSettings, event: 'settings.updated', tags: ['store-config'], category: 'general' },
  theme: { schema: ThemeTokens, event: 'settings.updated', tags: ['store-config'], category: 'general' },
  checkout: { schema: CheckoutSettings, event: 'settings.updated', tags: ['store-config'], category: 'general' },
  payments: { schema: PaymentSettings, event: 'settings.updated', tags: ['store-config'], category: 'money' },
  home: { schema: HomeContent, event: 'content.updated', tags: ['home'], category: 'general' },
})

/** Storefront paths that always exist. Others (/c, /collections, /p) are checked against the catalog once it exists. */
const STATIC_PATHS = /** @type {const} */ ([
  { href: '/', label: 'Home' }, { href: '/new', label: 'New arrivals' }, { href: '/sale', label: 'Sale' },
  { href: '/size-guide', label: 'Size guide' }, { href: '/track', label: 'Track an order' }, { href: '/cart', label: 'Cart' }, { href: '/wishlist', label: 'Wishlist' },
])

/** @param {unknown} v */
const clean = (v) => JSON.parse(JSON.stringify(v))

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {import('../../platform/config.js').Config} deps.config
 * @param {{ imagesFor: (ids: string[]) => Promise<Record<string, import('@noor/contract').Image>> }} deps.media
 * @param {() => Promise<ShippingFacts & { freeAboveFrom?: import('@noor/contract').Money, defaultEta?: { minDays: number, maxDays: number } }>} [deps.shippingFacts] arrives with the shipping module
 * @param {(href: string) => Promise<boolean>} [deps.catalogTargetLive] arrives with the catalog: is this /c, /collections or /p path live?
 * @param {() => Promise<{ ui: { total: number, translated: number }, products: { total: number, translated: number } }>} [deps.translationStatus]
 */
export function createSettingsService({ db, config, media, shippingFacts = async () => ({}), catalogTargetLive = async () => true, translationStatus = uiTranslationStatus }) {
  /** @param {Staff} a @param {RequestInfo} req */
  const actorOf = (a, req) => ({ actor: { type: /** @type {const} */ ('staff'), id: a.staffId, label: a.name, role: a.role }, ip: req.ip, userAgent: req.userAgent, requestId: req.requestId })

  // ---- documents ---------------------------------------------------------------------------------------------------------

  /** Media ids a document points at. @param {keyof typeof DOCS} key @param {any} value @returns {string[]} */
  const mediaIdsOf = (key, value) => {
    if (key === 'store') return [value.brand.logoLightMediaId, value.brand.logoDarkMediaId, value.brand.faviconMediaId].filter(Boolean)
    if (key === 'home') return [...value.heroSlides.map((/** @type {{ mediaId: string }} */ s) => s.mediaId), value.editorial.mediaId].filter(Boolean)
    return []
  }

  /** The stored value, or the default when nothing was saved or the stored JSON no longer fits the schema. @param {keyof typeof DOCS} key */
  async function readValue(key) {
    const row = await repo.getSetting(db, key)
    const parsed = row ? DOCS[key].schema.safeParse(row.value) : null
    return { value: /** @type {any} */ (parsed?.success ? parsed.data : defaults[key]), row }
  }

  /** What `admin.settings.get*` returns. @param {keyof typeof DOCS} key */
  async function view(key) {
    const { value, row } = await readValue(key)
    return {
      value,
      version: row?.version ?? 0,
      ...(row ? { updatedAt: row.updatedAt.toISOString(), ...(row.updatedByName ? { updatedBy: row.updatedByName } : {}) } : {}),
      images: await media.imagesFor(mediaIdsOf(key, value)),
    }
  }

  /** @param {import('../../platform/db.js').Executor} tx @param {string[]} ids */
  async function mustBeReady(tx, ids) {
    const unique = [...new Set(ids)]
    const ready = await readyIds(tx, unique)
    const bad = unique.find((id) => !ready.has(id))
    if (bad) throw new DomainError('media_not_ready', { mediaId: bad })
  }

  /** Rules beyond the shape of each document. @type {Record<keyof typeof DOCS, (tx: import('../../platform/db.js').Executor, value: any) => Promise<void>>} */
  const rules = {
    store: (tx, v) => mustBeReady(tx, mediaIdsOf('store', v)),
    home: (tx, v) => mustBeReady(tx, mediaIdsOf('home', v)),
    checkout: async () => {},
    theme: async (_tx, v) => {
      const pairs = contrastFailures(v.colors)
      if (pairs.length) throw new DomainError('theme_contrast_failed', { pairs })
    },
    payments: async (_tx, v) => {
      const enabled = v.methods.filter((/** @type {{ enabled: boolean }} */ m) => m.enabled)
      if (!enabled.length) throw new DomainError('no_payment_method')
      if (enabled.some((/** @type {{ type: string }} */ m) => m.type === 'bank_transfer') && !v.bankTransfer) {
        throw new DomainError('validation_failed', { issues: [{ path: 'bankTransfer', code: 'required' }] })
      }
    },
  }

  /**
   * @param {Staff} actor @param {keyof typeof DOCS} key @param {{ value: unknown, version: number }} input @param {RequestInfo} req
   */
  async function save(actor, key, input, req) {
    const doc = DOCS[key]
    const value = clean(doc.schema.parse(input.value)) // strips undefined; the route already validated, this keeps the stored JSON canonical
    await transaction(db, async (tx) => {
      const locked = await repo.lockSetting(tx, key)
      const current = locked?.version ?? 0
      if (input.version !== current) throw new DomainError('stale_write', { currentVersion: current })
      await rules[key](tx, value)
      const before = locked ? locked.value : defaults[key]
      const at = now()
      if (locked) await repo.updateSetting(tx, key, { value, version: current + 1, updatedAt: at, updatedBy: actor.staffId })
      else {
        try {
          await repo.insertSetting(tx, { key, value, version: 1, updatedAt: at, updatedBy: actor.staffId })
        } catch (e) {
          // two first saves at once: the other one won
          if (/** @type {{ cause?: { errno?: number }, errno?: number }} */ (e).cause?.errno === 1062) throw new DomainError('stale_write', { currentVersion: 1 })
          throw e
        }
      }
      await record(tx, { ...actorOf(actor, req), action: `${key === 'home' ? 'content' : 'settings'}.updated`, entityType: key === 'home' ? 'content' : 'settings', entityId: key, entityLabel: key, diff: diffOf(before, value), category: doc.category })
      await emit(tx, { type: doc.event, payload: { key, tags: doc.tags }, requestId: req.requestId })
    })
    return view(key)
  }

  // ---- pages ------------------------------------------------------------------------------------------------------------

  /** @param {repo.PageRow} p @param {string | null | undefined} updatedByName */
  const toAdminPage = (p, updatedByName) => {
    const ur = /** @type {{ ur?: { title?: string, bodyMd?: string } } | null} */ (p.i18n)?.ur
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      bodyMd: p.bodyMd,
      status: /** @type {'draft' | 'active'} */ (p.status),
      ...(p.seoTitle || p.seoDescription ? { seo: { ...(p.seoTitle ? { title: p.seoTitle } : {}), ...(p.seoDescription ? { description: p.seoDescription } : {}) } } : {}),
      ...(ur && (ur.title || ur.bodyMd) ? { i18n: { ur } } : {}),
      locked: p.locked,
      version: p.version,
      updatedAt: p.updatedAt.toISOString(),
      ...(updatedByName ? { updatedBy: updatedByName } : {}),
      storefrontUrl: `/pages/${p.slug}`,
    }
  }

  /** @param {import('@noor/contract').PageInput} input */
  const pageColumns = (input) => ({
    title: input.title,
    bodyMd: input.bodyMd,
    status: input.status,
    seoTitle: input.seo?.title || null,
    seoDescription: input.seo?.description || null,
    i18n: input.i18n?.ur?.title || input.i18n?.ur?.bodyMd ? { ur: clean(input.i18n.ur) } : null,
  })

  /** @param {string} id */
  const adminPage = async (id) => {
    const row = await repo.getPage(db, id)
    if (!row) throw new DomainError('not_found')
    return toAdminPage(row.page, row.updatedByName)
  }

  /** The words an audit reader wants to see for a page, without the whole body. @param {repo.PageRow | null} p */
  const pageSnapshot = (p) => (p ? { title: p.title, slug: p.slug, status: p.status, bodyMd: p.bodyMd, seoTitle: p.seoTitle, seoDescription: p.seoDescription, i18n: p.i18n } : {})

  // ---- menus ------------------------------------------------------------------------------------------------------------

  const newId = () => randomBytes(6).toString('hex')

  /** Gives every item an id and checks the shape limits of the menu. @param {'main' | 'footer'} handle @param {import('@noor/contract').MenuItemInput[]} items */
  function normaliseMenu(handle, items) {
    const limit = menuLimits[handle]
    /** @type {{ path: string, code: 'too_big' | 'not_unique' | 'invalid_format' }[]} */
    const issues = []
    const seen = new Set()
    if (items.length > limit.top) issues.push({ path: 'items', code: 'too_big' })
    /** @param {import('@noor/contract').MenuItemInput[]} list @param {number} level @param {string} path @returns {any[]} */
    const walk = (list, level, path) =>
      list.map((item, i) => {
        const here = `${path}.${i}`
        const id = item.id ?? newId()
        if (seen.has(id)) issues.push({ path: `${here}.id`, code: 'not_unique' })
        seen.add(id)
        const children = item.children ?? []
        if (children.length && level >= limit.levels) issues.push({ path: `${here}.children`, code: 'invalid_format' })
        else if (children.length > limit.children) issues.push({ path: `${here}.children`, code: 'too_big' })
        return { id, label: item.label, href: item.href, ...(item.i18n?.ur?.label ? { i18n: { ur: { label: item.i18n.ur.label } } } : {}), ...(children.length ? { children: walk(children, level + 1, `${here}.children`) } : {}) }
      })
    const out = walk(items, 1, 'items')
    if (issues.length) throw new DomainError('validation_failed', { issues })
    return out
  }

  /** Does a storefront link still lead somewhere? @param {Set<string>} livePages @param {string} href */
  async function targetLive(livePages, href) {
    if (!href.startsWith('/')) return true // https, mailto, tel: not ours to judge
    const path = href.split(/[?#]/)[0] ?? ''
    if (STATIC_PATHS.some((s) => s.href === path)) return true
    const page = /^\/pages\/([a-z0-9-]+)$/.exec(path)
    if (page) return livePages.has(page[1] ?? '')
    if (/^\/(c|collections|p)\/[A-Za-z0-9-]+$/.test(path)) return catalogTargetLive(path)
    return false
  }

  /** @param {any[]} items @param {Set<string>} livePages @returns {Promise<any[]>} */
  const withLiveness = (items, livePages) =>
    Promise.all(
      items.map(async (/** @type {any} */ it) => ({
        ...it,
        targetLive: await targetLive(livePages, it.href),
        ...(it.children ? { children: await withLiveness(it.children, livePages) } : {}),
      })),
    )

  const livePageSet = async () => new Set((await repo.activePages(db)).map((p) => p.slug))

  // ---- the shop's facts for public output -----------------------------------------------------------------------------------

  /** The Urdu text when asked for and present, else the English. @template T @param {Locale | undefined} locale @param {string | undefined} ur @param {T} en @returns {string | T} */
  const localised = (locale, ur, en) => (locale === 'ur' && ur ? ur : en)

  return {
    // ================================ admin: documents ================================
    /** @param {keyof typeof DOCS} key */
    get: (key) => view(key),
    save,

    async getPayments() {
      const v = await view('payments')
      return { ...v, adapters: paymentAdapters(v.value) }
    },
    /** @param {Staff} actor @param {{ value: unknown, version: number }} input @param {RequestInfo} req */
    async savePayments(actor, input, req) {
      await save(actor, 'payments', input, req)
      return this.getPayments()
    },

    themePresets: () => ({ items: Object.entries(themePresets).map(([id, theme]) => ({ id, label: id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()), theme })) }),
    translationStatus,

    // ================================ admin: pages ================================
    /** @param {{ q?: string, status?: string, sort?: string, page: number, size: number }} query */
    async listPages(query) {
      const r = await repo.listPages(db, query)
      if (!r) throw new DomainError('validation_failed', { issues: [{ path: 'sort', code: 'invalid_format' }] })
      return {
        items: r.rows.map((p) => ({ id: p.id, title: p.title, slug: p.slug, status: /** @type {'draft' | 'active'} */ (p.status), locked: p.locked, updatedAt: p.updatedAt.toISOString(), ...(p.updatedByName ? { updatedBy: p.updatedByName } : {}) })),
        total: r.total, page: query.page, size: query.size,
      }
    },

    getPage: adminPage,

    /** @param {string} bodyMd */
    async previewPage(bodyMd) {
      const [{ value }, facts] = await Promise.all([readValue('store'), shippingFacts()])
      return { bodyMd: resolveTokens(bodyMd, value, facts) }
    },

    /** @param {Staff} actor @param {import('@noor/contract').PageInput} input @param {RequestInfo} req */
    async createPage(actor, input, req) {
      const id = uuidv7()
      try {
        await transaction(db, async (tx) => {
          const at = now()
          await repo.dropRedirect(tx, input.slug)
          await repo.insertPage(tx, { id, slug: input.slug, ...pageColumns(input), locked: false, version: 1, updatedBy: actor.staffId, createdAt: at, updatedAt: at })
          await record(tx, { ...actorOf(actor, req), action: 'page.created', entityType: 'page', entityId: id, entityLabel: input.slug, diff: diffOf({}, { title: input.title, slug: input.slug, status: input.status }) })
          await emit(tx, { type: 'content.updated', payload: { page: input.slug, tags: [`page:${input.slug}`, 'pages'] }, requestId: req.requestId })
        })
      } catch (e) {
        if (/** @type {{ cause?: { errno?: number } }} */ (e).cause?.errno === 1062) throw new DomainError('slug_taken')
        throw e
      }
      return adminPage(id)
    },

    /** @param {Staff} actor @param {string} id @param {import('@noor/contract').PageInput & { version: number }} input @param {RequestInfo} req */
    async updatePage(actor, id, input, req) {
      try {
        await transaction(db, async (tx) => {
          const p = await repo.lockPage(tx, id)
          if (!p) throw new DomainError('not_found')
          if (p.version !== input.version) throw new DomainError('stale_write', { currentVersion: p.version })
          const slugChanged = input.slug !== p.slug
          if (p.locked && (slugChanged || input.status !== 'active')) throw new DomainError('page_locked')
          const at = now()
          if (slugChanged) {
            await repo.dropRedirect(tx, input.slug)
            await repo.upsertRedirect(tx, p.slug, id)
          }
          await repo.updatePage(tx, id, { slug: input.slug, ...pageColumns(input), version: p.version + 1, updatedBy: actor.staffId, updatedAt: at })
          const after = { ...p, slug: input.slug, ...pageColumns(input) }
          await record(tx, { ...actorOf(actor, req), action: 'page.updated', entityType: 'page', entityId: id, entityLabel: input.slug, diff: diffOf(pageSnapshot(p), pageSnapshot(/** @type {repo.PageRow} */ (after))) })
          await emit(tx, { type: 'content.updated', payload: { page: input.slug, tags: [`page:${input.slug}`, ...(slugChanged ? [`page:${p.slug}`] : []), 'pages', 'menus'] }, requestId: req.requestId })
        })
      } catch (e) {
        if (/** @type {{ cause?: { errno?: number } }} */ (e).cause?.errno === 1062) throw new DomainError('slug_taken')
        throw e
      }
      return adminPage(id)
    },

    /** @param {Staff} actor @param {string} id @param {RequestInfo} req */
    async deletePage(actor, id, req) {
      await transaction(db, async (tx) => {
        const p = await repo.lockPage(tx, id)
        if (!p) throw new DomainError('not_found')
        if (p.locked) throw new DomainError('page_locked')
        await repo.deletePage(tx, id)
        await record(tx, { ...actorOf(actor, req), action: 'page.deleted', entityType: 'page', entityId: id, entityLabel: p.slug, diff: diffOf(pageSnapshot(p), {}) })
        await emit(tx, { type: 'content.updated', payload: { page: p.slug, tags: [`page:${p.slug}`, 'pages', 'menus'] }, requestId: req.requestId })
      })
    },

    // ================================ admin: menus and links ================================
    /** @param {'main' | 'footer'} handle */
    async getMenu(handle) {
      const row = await repo.getMenu(db, handle)
      return { handle, version: row?.version ?? 0, items: await withLiveness(/** @type {any[]} */ (row?.items ?? []), await livePageSet()) }
    },

    /** @param {Staff} actor @param {'main' | 'footer'} handle @param {{ items: import('@noor/contract').MenuItemInput[], version: number }} input @param {RequestInfo} req */
    async saveMenu(actor, handle, input, req) {
      const items = normaliseMenu(handle, input.items)
      await transaction(db, async (tx) => {
        const locked = await repo.lockMenu(tx, handle)
        const current = locked?.version ?? 0
        if (input.version !== current) throw new DomainError('stale_write', { currentVersion: current })
        const at = now()
        if (locked) await repo.updateMenu(tx, handle, { items, version: current + 1, updatedAt: at, updatedBy: actor.staffId })
        else {
          try {
            await repo.insertMenu(tx, { handle, items, version: 1, updatedAt: at, updatedBy: actor.staffId })
          } catch (e) {
            if (/** @type {{ cause?: { errno?: number } }} */ (e).cause?.errno === 1062) throw new DomainError('stale_write', { currentVersion: 1 })
            throw e
          }
        }
        await record(tx, { ...actorOf(actor, req), action: 'menu.updated', entityType: 'menu', entityId: handle, entityLabel: handle, diff: diffOf({ items: locked?.items ?? [] }, { items }) })
        await emit(tx, { type: 'content.updated', payload: { menu: handle, tags: ['menus'] }, requestId: req.requestId })
      })
      return this.getMenu(handle)
    },

    /** Where a link can point. Categories, collections and products join when the catalog exists. @param {string} q */
    async searchLinks(q) {
      const term = q.toLowerCase()
      const statics = STATIC_PATHS.filter((s) => s.label.toLowerCase().includes(term) || s.href.includes(term)).map((s) => ({ type: /** @type {const} */ ('static'), label: s.label, href: s.href }))
      const found = (await repo.searchActivePages(db, q)).map((p) => ({ type: /** @type {const} */ ('page'), label: p.title, href: `/pages/${p.slug}` }))
      return { items: [...statics, ...found].slice(0, 20) }
    },

    // ================================ public ================================
    async storeConfig() {
      const [{ value: store }, { value: theme }, { value: payments }, { value: checkout }, facts] = await Promise.all([
        readValue('store'), readValue('theme'), readValue('payments'), readValue('checkout'), shippingFacts(),
      ])
      const images = await media.imagesFor(mediaIdsOf('store', store))
      const { brand, contact } = store
      return {
        brand: {
          name: brand.name,
          ...(brand.tagline ? { tagline: brand.tagline } : {}),
          ...(brand.logoLightMediaId && images[brand.logoLightMediaId] ? { logoLight: images[brand.logoLightMediaId] } : {}),
          ...(brand.logoDarkMediaId && images[brand.logoDarkMediaId] ? { logoDark: images[brand.logoDarkMediaId] } : {}),
          ...(brand.faviconMediaId && images[brand.faviconMediaId] ? { favicon: images[brand.faviconMediaId] } : {}),
        },
        theme,
        contact: {
          ...(contact.whatsapp ? { whatsapp: contact.whatsapp } : {}), ...(contact.phone ? { phone: contact.phone } : {}), ...(contact.email ? { email: contact.email } : {}),
          ...(contact.address ? { address: contact.address } : {}), ...(contact.mapUrl ? { mapUrl: contact.mapUrl } : {}), ...(contact.hours ? { hours: contact.hours } : {}),
          socials: contact.socials,
        },
        priceDisplay: store.priceDisplay,
        locale: store.locale,
        features: store.features,
        policies: store.policies,
        payments: payments.methods
          .filter((/** @type {{ enabled: boolean }} */ m) => m.enabled)
          .sort((/** @type {{ sortOrder: number }} */ a, /** @type {{ sortOrder: number }} */ b) => a.sortOrder - b.sortOrder)
          .map((/** @type {{ type: string, label: string, description?: string }} */ m) => ({ type: m.type, label: m.label, ...(m.description ? { description: m.description } : {}) })),
        shipping: {
          ...(facts.freeAboveFrom ? { freeAboveFrom: facts.freeAboveFrom } : {}),
          ...(facts.defaultEta ? { defaultEta: facts.defaultEta } : {}),
          ...(store.dispatchPromise ? { dispatchPromise: store.dispatchPromise } : {}),
        },
        checkout,
        seo: store.seo,
        environment: config.APP_ENV,
      }
    },

    /** @param {Locale} [locale] */
    async home(locale) {
      const { value: h } = await readValue('home')
      const ur = h.i18n?.ur
      const images = await media.imagesFor(mediaIdsOf('home', h))
      const at = now().toISOString()
      const announcement = localised(locale, ur?.announcement, h.announcement.text)
      /** @param {Record<string, string | undefined>} fields */
      const defined = (fields) => Object.fromEntries(Object.entries(fields).filter(([, v]) => v))
      const promoUr = ur?.promo
      const editorialUr = ur?.editorial
      return {
        ...(announcement ? { announcement: { text: announcement, ...(h.announcement.href ? { href: h.announcement.href } : {}) } } : {}),
        notices: h.notices
          .filter((/** @type {{ startsAt?: string, endsAt?: string }} */ n) => (!n.startsAt || n.startsAt <= at) && (!n.endsAt || at < n.endsAt))
          .map((/** @type {{ id: string, text: string, href?: string, severity: string }} */ n) => ({ id: n.id, text: localised(locale, ur?.notices?.[n.id], n.text), ...defined({ href: n.href }), severity: n.severity })),
        heroSlides: h.heroSlides
          .filter((/** @type {{ mediaId: string }} */ s) => images[s.mediaId])
          .map((/** @type {any} */ s) => {
            const t = ur?.heroSlides?.[s.id]
            const image = /** @type {import('@noor/contract').Image} */ (images[s.mediaId])
            return {
              id: s.id,
              image: { ...image, alt: localised(locale, t?.alt, s.alt) },
              heading: localised(locale, t?.heading, s.heading),
              ...defined({ subheading: localised(locale, t?.subheading, s.subheading), buttonText: localised(locale, t?.buttonText, s.buttonText), buttonHref: s.buttonHref }),
            }
          }),
        ...(h.promo.enabled && h.promo.heading
          ? { promo: { heading: localised(locale, promoUr?.heading, h.promo.heading), ...defined({ eyebrow: localised(locale, promoUr?.eyebrow, h.promo.eyebrow), text: localised(locale, promoUr?.text, h.promo.text), buttonText: localised(locale, promoUr?.buttonText, h.promo.buttonText), buttonHref: h.promo.buttonHref }) } }
          : {}),
        ...(h.editorial.enabled && h.editorial.heading
          ? {
              editorial: {
                heading: localised(locale, editorialUr?.heading, h.editorial.heading),
                ...(h.editorial.mediaId && images[h.editorial.mediaId] ? { image: { .../** @type {import('@noor/contract').Image} */ (images[h.editorial.mediaId]), alt: localised(locale, editorialUr?.alt, h.editorial.alt) ?? '' } } : {}),
                ...defined({ eyebrow: localised(locale, editorialUr?.eyebrow, h.editorial.eyebrow), text: localised(locale, editorialUr?.text, h.editorial.text), buttonText: localised(locale, editorialUr?.buttonText, h.editorial.buttonText), buttonHref: h.editorial.buttonHref }),
              },
            }
          : {}),
        footer: h.footer.about ? { about: localised(locale, ur?.footerAbout, h.footer.about) } : {},
      }
    },

    /** Items whose target is gone are left out, with their children. @param {'main' | 'footer'} handle @param {Locale} [locale] */
    async menu(handle, locale) {
      const row = await repo.getMenu(db, handle)
      const live = await livePageSet()
      /** @param {any[]} items @returns {Promise<any[]>} */
      const walk = async (items) => {
        const out = []
        for (const it of items) {
          if (!(await targetLive(live, it.href))) continue
          const children = it.children ? await walk(it.children) : []
          out.push({ id: it.id, label: localised(locale, it.i18n?.ur?.label, it.label), href: it.href, ...(children.length ? { children } : {}) })
        }
        return out
      }
      return { handle, items: await walk(/** @type {any[]} */ (row?.items ?? [])) }
    },

    /** @param {string} slug @param {Locale} [locale] */
    async page(slug, locale) {
      const p = await repo.pageBySlug(db, slug)
      if (!p || p.status !== 'active') {
        const to = p ? undefined : await repo.redirectTarget(db, slug)
        if (to && to.status === 'active') return { redirectTo: `/pages/${to.slug}` }
        throw new DomainError('not_found')
      }
      const [{ value: store }, facts] = await Promise.all([readValue('store'), shippingFacts()])
      const ur = /** @type {{ ur?: { title?: string, bodyMd?: string } } | null} */ (p.i18n)?.ur
      const inUrdu = locale === 'ur' && !!ur?.bodyMd
      return {
        slug: p.slug,
        title: inUrdu && ur?.title ? ur.title : p.title,
        bodyMd: resolveTokens(inUrdu && ur?.bodyMd ? ur.bodyMd : p.bodyMd, store, facts),
        seo: { ...(p.seoTitle ? { title: p.seoTitle } : {}), ...(p.seoDescription ? { description: p.seoDescription } : {}) },
        updatedAt: p.updatedAt.toISOString(),
        locale: /** @type {Locale} */ (inUrdu ? 'ur' : 'en'),
      }
    },

    async listPublicPages() {
      return { items: (await repo.activePages(db)).map((p) => ({ slug: p.slug, title: p.title, updatedAt: p.updatedAt.toISOString() })) }
    },

    /** Units at or below which a variant reads "low stock". */
    async lowStock() {
      return (await readValue('store')).value.thresholds.lowStock
    },

    /** Is this media still used by a settings document? Checked before a file is deleted. @param {string} mediaId */
    async mediaInUse(mediaId) {
      for (const key of /** @type {const} */ (['store', 'home'])) {
        const row = await repo.getSetting(db, key)
        if (row && JSON.stringify(row.value).includes(mediaId)) return true
      }
      return false
    },
  }
}

/** Which payment methods have anything behind them: cash on delivery always, bank transfer once account details exist. @param {any} payments */
function paymentAdapters(payments) {
  return /** @type {const} */ (['cod', 'bank_transfer', 'wallet', 'card', 'bnpl']).map((type) => ({
    type,
    configured: type === 'cod' || (type === 'bank_transfer' && !!payments.bankTransfer),
  }))
}
