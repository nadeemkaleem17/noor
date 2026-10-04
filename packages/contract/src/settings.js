// Store settings documents and the admin routes that read and write them (plan/09-data-model/09 section 2, plan/10-api/07 section 2),
// plus the public store configuration (plan/10-api/01 section 3). Each document is validated by its schema here and by the
// service's own rules (media is ready, at least one payment method ...).
import { z } from 'zod'
import { Enum } from './enums.js'
import { isValidLink } from './link.js'
import { Money } from './money.js'
import { Image, FormField, Id, IsoDate, ThemeTokens } from './primitives.js'
import { defineRoutes } from './routes.js'

/** A link an admin typed: `/path`, `https://`, `mailto:` or `tel:` (DOC-07.9 section 2). */
export const Link = z.string().trim().max(500).refine(isValidLink, 'link_invalid')
/** Map and social links must be `https://` (DOC-07.11 section 2). */
const HttpsLink = z.string().trim().max(500).refine((v) => isValidLink(v) && v.startsWith('https://'), 'link_invalid')
const text = (/** @type {number} */ max) => z.string().trim().max(max)
const Locale = Enum.locale

// ---- store -----------------------------------------------------------------------------------------------------------------

export const StoreSettings = z.strictObject({
  brand: z.strictObject({
    name: z.string().trim().min(1).max(60),
    tagline: text(120).optional(),
    logoLightMediaId: Id.optional(),
    logoDarkMediaId: Id.optional(),
    faviconMediaId: Id.optional(),
  }),
  contact: z.strictObject({
    /** E.164 digits without the plus, e.g. 923001234567: used for every wa.me link. */
    whatsapp: z.string().regex(/^\d{10,15}$/, 'phone_invalid').optional(),
    phone: text(30).optional(),
    email: z.email().max(254).optional(),
    address: text(300).optional(),
    mapUrl: HttpsLink.optional(),
    hours: text(120).optional(),
    socials: z.array(z.strictObject({ platform: z.enum(['instagram', 'facebook', 'tiktok', 'youtube', 'pinterest']), url: HttpsLink })).max(8),
  }),
  priceDisplay: z.strictObject({ showDecimals: z.boolean(), rounding: z.enum(['none', 'nearest', 'up']) }),
  orderNumberPrefix: z.string().regex(/^[A-Z]{2,4}$/, 'code_invalid'),
  locale: z.strictObject({ default: Locale, supported: z.array(Locale).min(1).max(2) }).refine((l) => l.supported.includes(l.default), { message: 'invalid_format', path: ['supported'] }),
  features: z.strictObject({ wishlist: z.boolean(), reviews: z.boolean(), notifyMe: z.boolean(), customSizing: z.boolean() }),
  policies: z.strictObject({
    returnsDays: z.int().min(0).max(90).optional(),
    returns: text(300).optional(),
    shipping: text(300).optional(),
    privacy: text(300).optional(),
    terms: text(300).optional(),
  }),
  seo: z.strictObject({ homeDescription: text(160).optional() }),
  notifications: z.strictObject({ staffEmails: z.array(z.email().max(254)).max(10) }),
  thresholds: z.strictObject({ lowStock: z.int().min(0).max(1000), highValueCodMinor: z.int().min(0) }),
  dispatchPromise: text(100).optional(),
})
/** @typedef {z.infer<typeof StoreSettings>} StoreSettings */

// ---- checkout ---------------------------------------------------------------------------------------------------------------

/** Fields every checkout has; an extra field may not reuse their keys. */
export const fixedCheckoutKeys = /** @type {const} */ (['name', 'phone', 'email', 'city', 'address', 'landmark', 'notes'])

export const CheckoutSettings = z.strictObject({
  extraFields: z.array(FormField).max(3).refine((fs) => new Set(fs.map((f) => f.key)).size === fs.length && !fs.some((f) => (/** @type {readonly string[]} */ (fixedCheckoutKeys)).includes(f.key)), { message: 'not_unique', path: [] }),
  marketingConsent: z.strictObject({ enabled: z.boolean(), label: text(160) }),
})
/** @typedef {z.infer<typeof CheckoutSettings>} CheckoutSettings */

// ---- payments ---------------------------------------------------------------------------------------------------------------

export const PaymentSettings = z.strictObject({
  methods: z.array(z.strictObject({
    type: Enum.paymentMethod,
    enabled: z.boolean(),
    label: z.string().trim().min(1).max(40),
    description: text(200).optional(),
    sortOrder: z.int().min(0).max(100),
  })).max(5).refine((ms) => new Set(ms.map((m) => m.type)).size === ms.length, { message: 'not_unique', path: [] }),
  codLimitMinor: z.int().min(0).optional(),
  bankTransfer: z.strictObject({
    accountTitle: z.string().trim().min(1).max(100),
    bank: z.string().trim().min(1).max(100),
    accountNumber: z.string().trim().min(1).max(40),
    instructions: text(300),
  }).optional(),
})
/** @typedef {z.infer<typeof PaymentSettings>} PaymentSettings */

// ---- home content -----------------------------------------------------------------------------------------------------------

const Button = { buttonText: text(24).optional(), buttonHref: Link.optional() }
/** A button needs both its text and its link, or neither (DOC-07.9 section 2). */
const bothOrNeither = (/** @type {{ buttonText?: string, buttonHref?: string }} */ v) => !!v.buttonText === !!v.buttonHref
const buttonRule = { message: 'required', path: ['buttonText'] }
const SlideId = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, 'handle_invalid')

export const HomeContent = z.strictObject({
  announcement: z.strictObject({ text: text(100), href: Link.optional() }),
  notices: z.array(z.strictObject({
    id: SlideId,
    text: z.string().trim().min(1).max(140),
    href: Link.optional(),
    severity: z.enum(['info', 'promo', 'notice']),
    startsAt: IsoDate.optional(),
    endsAt: IsoDate.optional(),
  }).refine((n) => !n.startsAt || !n.endsAt || n.startsAt < n.endsAt, { message: 'invalid_format', path: ['endsAt'] })).max(5),
  heroSlides: z.array(z.strictObject({
    id: SlideId,
    mediaId: Id,
    alt: z.string().trim().min(1).max(150),
    heading: z.string().trim().min(1).max(60),
    subheading: text(90).optional(),
    ...Button,
  }).refine(bothOrNeither, buttonRule)).max(6),
  promo: z.strictObject({ enabled: z.boolean(), eyebrow: text(30).optional(), heading: text(60).optional(), text: text(200).optional(), ...Button }).refine(bothOrNeither, buttonRule),
  editorial: z.strictObject({ enabled: z.boolean(), mediaId: Id.optional(), alt: text(150).optional(), eyebrow: text(30).optional(), heading: text(60).optional(), text: text(300).optional(), ...Button }).refine(bothOrNeither, buttonRule),
  footer: z.strictObject({ about: text(300) }),
  /** Urdu text by the id of what it translates. Anything missing falls back to English. */
  i18n: z.strictObject({
    ur: z.strictObject({
      announcement: text(100).optional(),
      notices: z.record(SlideId, text(140)).optional(),
      heroSlides: z.record(SlideId, z.strictObject({ alt: text(150).optional(), heading: text(60).optional(), subheading: text(90).optional(), buttonText: text(24).optional() })).optional(),
      promo: z.strictObject({ eyebrow: text(30).optional(), heading: text(60).optional(), text: text(200).optional(), buttonText: text(24).optional() }).optional(),
      editorial: z.strictObject({ alt: text(150).optional(), eyebrow: text(30).optional(), heading: text(60).optional(), text: text(300).optional(), buttonText: text(24).optional() }).optional(),
      footerAbout: text(300).optional(),
    }).optional(),
  }).optional(),
})
/** @typedef {z.infer<typeof HomeContent>} HomeContent */

// ---- admin routes ------------------------------------------------------------------------------------------------------------

/** What every document read returns. `version` 0 means "never saved": the value is the default. `images` previews each media id in the value. */
const Doc = (/** @type {z.ZodType} */ value, extra = {}) =>
  z.strictObject({ value, version: z.int().min(0), updatedAt: IsoDate.optional(), updatedBy: z.string().optional(), images: z.record(Id, Image), ...extra })
const Write = (/** @type {z.ZodType} */ value) => z.strictObject({ value, version: z.int().min(0) })

export const PaymentAdapters = z.array(z.strictObject({ type: Enum.paymentMethod, configured: z.boolean() }))

export const ThemePreset = z.strictObject({ id: z.string(), label: z.string(), theme: ThemeTokens })

export const settingsRoutes = defineRoutes({
  'admin.settings.getStore': { method: 'GET', path: '/admin/settings/store', auth: 'staff', permission: 'settings:read', response: Doc(StoreSettings) },
  'admin.settings.updateStore': { method: 'PUT', path: '/admin/settings/store', auth: 'staff', permission: 'settings:write', body: Write(StoreSettings), response: Doc(StoreSettings) },
  'admin.settings.getTheme': { method: 'GET', path: '/admin/settings/theme', auth: 'staff', permission: 'settings:read', response: Doc(ThemeTokens) },
  'admin.settings.updateTheme': { method: 'PUT', path: '/admin/settings/theme', auth: 'staff', permission: 'settings:write', body: Write(ThemeTokens), response: Doc(ThemeTokens) },
  'admin.settings.getCheckout': { method: 'GET', path: '/admin/settings/checkout', auth: 'staff', permission: 'settings:read', response: Doc(CheckoutSettings) },
  'admin.settings.updateCheckout': { method: 'PUT', path: '/admin/settings/checkout', auth: 'staff', permission: 'settings:write', body: Write(CheckoutSettings), response: Doc(CheckoutSettings) },
  'admin.settings.getPayments': { method: 'GET', path: '/admin/settings/payments', auth: 'staff', permission: 'settings:read', response: Doc(PaymentSettings, { adapters: PaymentAdapters }) },
  'admin.settings.updatePayments': { method: 'PUT', path: '/admin/settings/payments', auth: 'staff', permission: 'settings:write', body: Write(PaymentSettings), response: Doc(PaymentSettings, { adapters: PaymentAdapters }) },
  'admin.content.getHome': { method: 'GET', path: '/admin/content/home', auth: 'staff', permission: 'content:read', response: Doc(HomeContent) },
  'admin.content.updateHome': { method: 'PUT', path: '/admin/content/home', auth: 'staff', permission: 'content:write', body: Write(HomeContent), response: Doc(HomeContent) },
  'admin.settings.themePresets': { method: 'GET', path: '/admin/settings/theme/presets', auth: 'staff', permission: 'settings:read', response: z.strictObject({ items: z.array(ThemePreset) }) },
  'admin.settings.translationStatus': {
    method: 'GET', path: '/admin/settings/translation-status', auth: 'staff', permission: 'settings:read',
    response: z.strictObject({ ui: z.strictObject({ total: z.int(), translated: z.int() }), products: z.strictObject({ total: z.int(), translated: z.int() }) }),
  },
})

// ---- public ------------------------------------------------------------------------------------------------------------------

const LocaleQuery = z.strictObject({ locale: Locale.optional() })

export const StoreConfigPublic = z.strictObject({
  brand: z.strictObject({ name: z.string(), tagline: z.string().optional(), logoLight: Image.optional(), logoDark: Image.optional(), favicon: Image.optional() }),
  theme: ThemeTokens,
  contact: z.strictObject({
    whatsapp: z.string().optional(), phone: z.string().optional(), email: z.string().optional(), address: z.string().optional(),
    mapUrl: z.string().optional(), hours: z.string().optional(), socials: z.array(z.strictObject({ platform: z.string(), url: z.string() })),
  }),
  priceDisplay: StoreSettings.shape.priceDisplay,
  locale: z.strictObject({ default: Locale, supported: z.array(Locale) }),
  features: StoreSettings.shape.features,
  policies: StoreSettings.shape.policies,
  payments: z.array(z.strictObject({ type: Enum.paymentMethod, label: z.string(), description: z.string().optional() })),
  shipping: z.strictObject({
    freeAboveFrom: Money.optional(),
    defaultEta: z.strictObject({ minDays: z.int(), maxDays: z.int() }).optional(),
    dispatchPromise: z.string().optional(),
  }),
  checkout: z.strictObject({ extraFields: z.array(FormField), marketingConsent: z.strictObject({ enabled: z.boolean(), label: z.string() }) }),
  seo: z.strictObject({ homeDescription: z.string().optional() }),
  environment: z.enum(['local', 'ci', 'staging', 'production']),
})
/** @typedef {z.infer<typeof StoreConfigPublic>} StoreConfigPublic */

const PublicButton = { buttonText: z.string().optional(), buttonHref: z.string().optional() }
export const HomePublic = z.strictObject({
  announcement: z.strictObject({ text: z.string(), href: z.string().optional() }).optional(),
  notices: z.array(z.strictObject({ id: z.string(), text: z.string(), href: z.string().optional(), severity: z.enum(['info', 'promo', 'notice']) })),
  heroSlides: z.array(z.strictObject({ id: z.string(), image: Image, heading: z.string(), subheading: z.string().optional(), ...PublicButton })),
  promo: z.strictObject({ eyebrow: z.string().optional(), heading: z.string(), text: z.string().optional(), ...PublicButton }).optional(),
  editorial: z.strictObject({ image: Image.optional(), eyebrow: z.string().optional(), heading: z.string(), text: z.string().optional(), ...PublicButton }).optional(),
  footer: z.strictObject({ about: z.string().optional() }),
})
/** @typedef {z.infer<typeof HomePublic>} HomePublic */

/** Public reads are shared-cacheable: `cache: 'shared'` is `public, s-maxage=60, stale-while-revalidate=600` (DOC-10.1 section 1). */
export const settingsPublicRoutes = defineRoutes({
  'store.getConfig': { method: 'GET', path: '/store/config', auth: 'public', cache: 'shared', query: LocaleQuery, response: StoreConfigPublic },
  'content.getHome': { method: 'GET', path: '/content/home', auth: 'public', cache: 'shared', query: LocaleQuery, response: HomePublic },
})

export { LocaleQuery }
