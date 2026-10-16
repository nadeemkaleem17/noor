// The public catalog: listings with facets, product detail, categories, collections, size charts, forms, back-in-stock requests and
// sitemap entries (plan/10-api/02-catalog-public.md). Only active products, visible categories and live collections are ever returned.
// Reviews (`reviews.listForProduct`) are in reviews.js; `rating` on a card comes from the product's rating columns.
import { z } from 'zod'
import { Component, Fit } from './products.js'
import { Enum } from './enum-schemas.js'
import { Money } from './money-schema.js'
import { CursorPage, csv, flag, qint } from './pagination.js'
import { PkMobile } from './phone.js'
import { FormField, Id, Image, IsoDate, Swatch } from './primitives.js'
import { defineRoutes } from './routes.js'
import { LocaleQuery } from './settings.js'

const Locale = Enum.locale
const Seo = z.strictObject({ title: z.string().optional(), description: z.string().optional() })

// ---- listing ----------------------------------------------------------------------------------------------------------------

export const listingSorts = /** @type {const} */ (['featured', 'newest', 'price_asc', 'price_desc', 'bestselling', 'relevance'])

/** Filters on top of these named ones are `attr.<code>=a,b`; the server checks them against the attributes that exist (unknown ones are `400`). */
export const ListingQuery = z.looseObject({
  category: z.string().max(80).optional(),
  collection: z.string().max(80).optional(),
  ids: csv(Id).pipe(z.array(Id).max(100)).optional(),
  q: z.string().trim().min(2).max(80).optional(),
  onlyNew: flag.optional(),
  onlySale: flag.optional(),
  kind: csv(Enum.productKind).optional(),
  size: csv(z.string().max(10)).optional(),
  color: csv(Enum.colorFamily).optional(),
  inStock: flag.optional(),
  priceMin: qint(z.int().min(0)).optional(),
  priceMax: qint(z.int().min(0)).optional(),
  sort: z.enum(listingSorts).optional(),
  limit: qint(z.int().min(1).max(48)).default(24),
  cursor: z.string().max(500).optional(),
  facets: flag.default(true),
  locale: Locale.optional(),
})

export const productBadgeNames = /** @type {const} */ (['new', 'sale', 'bestseller', 'limited', 'made_to_order', 'sold_out'])

export const ProductSummary = z.strictObject({
  id: Id,
  handle: z.string(),
  title: z.string(),
  brand: z.string().optional(),
  kind: Enum.productKind,
  primaryImage: Image,
  secondaryImage: Image.optional(),
  priceFrom: Money,
  priceTo: Money.optional(),
  compareAtFrom: Money.optional(),
  badges: z.array(z.enum(productBadgeNames)),
  stockStatus: Enum.stockStatus,
  colorways: z.array(z.strictObject({ handle: z.string(), label: z.string(), swatch: Swatch, current: z.boolean() })),
  rating: z.strictObject({ average: z.number(), count: z.int() }).optional(),
})
/** @typedef {z.infer<typeof ProductSummary>} ProductSummary */

export const Facet = z.strictObject({
  key: z.string(),
  label: z.string(),
  display: Enum.attributeDisplay,
  values: z.array(z.strictObject({ value: z.string(), label: z.string(), count: z.int(), swatch: Swatch.optional(), selected: z.boolean() })),
  seoIndexable: z.boolean().optional(),
})
/** @typedef {z.infer<typeof Facet>} Facet */

export const ProductListing = z.strictObject({
  items: z.array(ProductSummary),
  total: z.int(),
  nextCursor: z.string().optional(),
  facets: z.array(Facet).optional(),
  pricePresets: z.array(z.strictObject({ min: z.int().optional(), max: z.int().optional() })).optional(),
})
/** @typedef {z.infer<typeof ProductListing>} ProductListing */

// ---- detail -----------------------------------------------------------------------------------------------------------------

const DetailOption = z.strictObject({
  id: Id,
  name: z.string(),
  role: Enum.optionRole,
  display: Enum.optionDisplay,
  values: z.array(z.strictObject({ id: Id, label: z.string(), kind: Enum.optionValueKind, swatch: Swatch.optional() })),
})
const DetailVariant = z.strictObject({
  id: Id,
  sku: z.string(),
  optionValueIds: z.array(Id),
  price: Money,
  compareAt: Money.optional(),
  stockStatus: Enum.stockStatus,
  /** Units left, but never more than `maxPerOrder`: a customer cannot learn how many exist. Only for counted stock. */
  available: z.int().optional(),
  maxPerOrder: z.int(),
  preorderShipsAt: z.string().optional(),
})
const Badges = z.array(z.enum(productBadgeNames))

export const ProductDetail = z.strictObject({
  id: Id,
  handle: z.string(),
  kind: Enum.productKind,
  status: Enum.productStatus,
  title: z.string(),
  subtitle: z.string().optional(),
  brand: z.string().optional(),
  descriptionMd: z.string().optional(),
  highlights: z.array(z.string()),
  care: z.array(z.string()),
  breadcrumb: z.array(z.strictObject({ handle: z.string(), name: z.string() })),
  media: z.array(Image.safeExtend({ id: Id, kind: Enum.mediaKind, role: Enum.mediaRole.optional(), videoSrc: z.string().optional(), optionValueId: Id.optional() })),
  options: z.array(DetailOption),
  variants: z.array(DetailVariant),
  components: z.array(Component),
  attributes: z.array(z.strictObject({ group: z.string().optional(), label: z.string(), values: z.array(z.string()) })),
  colorway: z.strictObject({ label: z.string(), family: Enum.colorFamily, swatch: Swatch }).optional(),
  siblings: z.array(z.strictObject({ handle: z.string(), label: z.string(), swatch: Swatch, image: Image, current: z.boolean() })),
  sizeChartId: Id.optional(),
  customSizeSchemaId: Id.optional(),
  fit: Fit.optional(),
  madeToOrder: z.strictObject({ leadMinDays: z.int(), leadMaxDays: z.int(), label: z.string(), returnable: z.boolean(), depositPercent: z.number().optional() }).optional(),
  bundle: z.strictObject({ items: z.array(z.strictObject({ product: ProductSummary, options: z.array(DetailOption), variants: z.array(DetailVariant) })) }).optional(),
  badges: Badges,
  /** Approved reviews only; absent while there are none. */
  rating: z.strictObject({ average: z.number(), count: z.int() }).optional(),
  delivery: z.strictObject({ etaMinDays: z.int().optional(), etaMaxDays: z.int().optional(), codAvailable: z.boolean(), freeAbove: Money.optional() }),
  seo: Seo,
  updatedAt: IsoDate,
})
/** @typedef {z.infer<typeof ProductDetail>} ProductDetail */

// ---- the rest ---------------------------------------------------------------------------------------------------------------

/** @typedef {{ id: string, handle: string, name: string, image?: z.infer<typeof Image>, productCount: number, children: CategoryNode[] }} CategoryNode */
/** @type {z.ZodType<CategoryNode>} */
export const CategoryNode = z.lazy(() =>
  z.strictObject({ id: Id, handle: z.string(), name: z.string(), image: Image.optional(), productCount: z.int(), children: z.array(CategoryNode) }),
)

export const CategoryDetail = z.strictObject({
  id: Id,
  handle: z.string(),
  name: z.string(),
  description: z.string().optional(),
  image: Image.optional(),
  breadcrumb: z.array(z.strictObject({ handle: z.string(), name: z.string() })),
  children: z.array(z.strictObject({ handle: z.string(), name: z.string() })),
  seo: Seo,
})
export const CollectionSummary = z.strictObject({ id: Id, handle: z.string(), title: z.string(), image: Image.optional() })
export const CollectionDetail = CollectionSummary.safeExtend({ description: z.string().optional(), seo: Seo })
export const SizeChartPublic = z.strictObject({
  id: Id,
  title: z.string(),
  unit: z.enum(['in', 'cm']),
  notes: z.string().optional(),
  guideImage: Image.optional(),
  tables: z.array(z.strictObject({ id: z.string(), title: z.string(), columns: z.array(z.string()), rows: z.array(z.strictObject({ label: z.string(), values: z.array(z.number()) })) })),
})
export const FormSchemaPublic = z.strictObject({ id: Id, title: z.string().optional(), fields: z.array(FormField), allowNotes: z.boolean() })
/** @typedef {z.infer<typeof SizeChartPublic>} SizeChart */
/** @typedef {z.infer<typeof FormSchemaPublic>} CustomSizeForm */

export const SitemapEntry = z.strictObject({
  loc: z.string(),
  lastmod: IsoDate,
  image: z.string().optional(),
  type: z.enum(['home', 'category', 'collection', 'product', 'page', 'facet']),
})

/** What the search box offers while someone types (DOC-06.11 section 5.2): a few products, the categories and collections whose name matches, and how many results the full page has. */
export const Suggestions = z.strictObject({
  products: z.array(ProductSummary),
  total: z.int(),
  categories: z.array(z.strictObject({ handle: z.string(), name: z.string() })),
  collections: z.array(z.strictObject({ handle: z.string(), title: z.string() })),
})
/** @typedef {z.infer<typeof Suggestions>} Suggestions */

const Redirect = z.strictObject({ redirectTo: z.string() })
const HandleParams = z.strictObject({ handle: z.string().min(1).max(80) })
const IdParams = z.strictObject({ id: Id })

export const catalogPublicRoutes = defineRoutes({
  'catalog.listProducts': { method: 'GET', path: '/products', auth: 'public', cache: 'shared', query: ListingQuery, response: ProductListing },
  'catalog.suggest': { method: 'GET', path: '/search/suggest', auth: 'public', cache: 'shared', query: LocaleQuery.safeExtend({ q: z.string().trim().min(2).max(80) }), response: Suggestions },
  'catalog.getProduct': {
    method: 'GET', path: '/products/:handleOrId', auth: 'public', cache: 'shared',
    params: z.strictObject({ handleOrId: z.string().min(1).max(80) }),
    query: LocaleQuery.safeExtend({ preview: z.string().max(200).optional() }),
    response: z.union([ProductDetail, Redirect]),
  },
  'catalog.listRelated': {
    method: 'GET', path: '/products/:id/related', auth: 'public', cache: 'shared', params: IdParams,
    query: LocaleQuery.safeExtend({ limit: qint(z.int().min(4).max(8)).default(8) }),
    response: z.strictObject({ items: z.array(ProductSummary) }),
  },
  'catalog.listCategories': { method: 'GET', path: '/categories', auth: 'public', cache: 'shared', query: LocaleQuery, response: z.strictObject({ items: z.array(CategoryNode) }) },
  'catalog.getCategory': { method: 'GET', path: '/categories/:handle', auth: 'public', cache: 'shared', params: HandleParams, query: LocaleQuery, response: z.union([CategoryDetail, Redirect]) },
  'catalog.listCollections': {
    method: 'GET', path: '/collections', auth: 'public', cache: 'shared',
    query: LocaleQuery.safeExtend({ featured: flag.optional(), limit: qint(z.int().min(1).max(24)).default(24) }),
    response: z.strictObject({ items: z.array(CollectionSummary) }),
  },
  'catalog.getCollection': { method: 'GET', path: '/collections/:handle', auth: 'public', cache: 'shared', params: HandleParams, query: LocaleQuery, response: z.union([CollectionDetail, Redirect]) },
  'catalog.listSizeCharts': { method: 'GET', path: '/size-charts', auth: 'public', cache: 'shared', response: z.strictObject({ items: z.array(SizeChartPublic) }) },
  'catalog.getSizeChart': { method: 'GET', path: '/size-charts/:id', auth: 'public', cache: 'shared', params: IdParams, response: SizeChartPublic },
  'catalog.getFormSchema': { method: 'GET', path: '/form-schemas/:id', auth: 'public', cache: 'shared', params: IdParams, response: FormSchemaPublic },
  'catalog.subscribeBackInStock': {
    method: 'POST', path: '/variants/:id/stock-subscriptions', auth: 'public', rateLimit: 'notify', status: 204, params: IdParams,
    body: z.strictObject({ phone: PkMobile, locale: Locale.optional() }), response: z.undefined(),
  },
  'seo.listSitemapEntries': {
    method: 'GET', path: '/sitemap-entries', auth: 'public',
    query: z.strictObject({ limit: qint(z.int().min(1).max(5000)).default(5000), cursor: z.string().max(100).optional() }),
    response: CursorPage(SitemapEntry),
  },
})
