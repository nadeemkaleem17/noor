// Products, variants and collections: the admin side (plan/10-api/05-admin-catalog.md sections 2 and 6, plan/09-data-model/03-catalog.md
// sections 5-6). A product is saved as one document with its version; variants, options and option values are matched by id.
// Stock quantities are not part of the document (they belong to inventory, DOC-07.3 section 7.1).
import { z } from 'zod'
import { Slug } from './content.js'
import { Enum } from './enums.js'
import { Money } from './money.js'
import { BulkResult, Page, PageQuery } from './pagination.js'
import { InitialStock } from './inventory.js'
import { Id, Image, IsoDate, Swatch } from './primitives.js'
import { defineRoutes } from './routes.js'

const text = (/** @type {number} */ max) => z.string().trim().max(max)
const Key = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, 'handle_invalid')
const Cost = Money.refine((m) => m.amount > 0, 'too_small')
const IdParams = z.strictObject({ id: Id })

export const componentTypes = /** @type {const} */ (['shirt', 'dupatta', 'trouser', 'shalwar', 'slip', 'lehnga', 'blouse', 'jacket', 'scarf', 'other'])

/** One piece of an unstitched set. */
export const Component = z.strictObject({
  type: z.enum(componentTypes),
  label: z.string().trim().min(1).max(60),
  fabric: text(60).optional(),
  color: text(40).optional(),
  technique: text(60).optional(),
  quantity: text(20).optional(),
  included: z.boolean(),
})

export const Fit = z.strictObject({
  note: Enum.fitNote.optional(),
  cut: text(40).optional(),
  modelHeightCm: z.int().min(100).max(230).optional(),
  modelWears: text(10).optional(),
})

export const productBadges = /** @type {const} */ (['new', 'bestseller', 'limited'])

export const OptionValueInput = z.strictObject({
  id: Id.optional(),
  /** Names the value inside this document so variants can refer to it before it has an id. */
  key: Key,
  label: z.string().trim().min(1).max(40),
  kind: Enum.optionValueKind.optional(),
  sizeSystemValueId: Id.optional(),
  swatch: Swatch.optional(),
  i18n: z.strictObject({ ur: z.strictObject({ label: text(40).optional() }).optional() }).optional(),
})
export const OptionInput = z.strictObject({
  id: Id.optional(),
  name: z.string().trim().min(1).max(40),
  role: Enum.optionRole,
  display: Enum.optionDisplay,
  sizeSystemId: Id.optional(),
  values: z.array(OptionValueInput).min(1).max(30),
  i18n: z.strictObject({ ur: z.strictObject({ name: text(40).optional() }).optional() }).optional(),
})
export const VariantInput = z.strictObject({
  id: Id.optional(),
  key: Key,
  sku: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9._-]+$/, 'sku_invalid'),
  /** The `key` of one value of each option. Empty for a product without options. */
  optionValueKeys: z.array(Key).max(3),
  price: Cost,
  compareAt: Cost.optional(),
  stockMode: Enum.stockMode,
  preorderShipsAt: z.iso.date().optional(),
  maxPerOrder: z.int().min(1).max(99),
  enabled: z.boolean(),
})
export const MediaLink = z.strictObject({
  mediaId: Id,
  alt: z.string().trim().max(300),
  role: Enum.mediaRole.optional(),
  /** The `key` of an option value this picture is shown for. */
  optionValueKey: Key.optional(),
})

export const ProductInput = z.strictObject({
  handle: Slug,
  status: Enum.productStatus,
  publishAt: IsoDate.optional(),
  kind: Enum.productKind,
  title: z.string().trim().min(1).max(120),
  subtitle: text(160).optional(),
  brand: text(60).optional(),
  descriptionMd: z.string().max(5000).optional(),
  highlights: z.array(z.string().trim().min(1).max(120)).max(6).optional(),
  care: z.array(z.string().trim().min(1).max(120)).max(8).optional(),
  components: z.array(Component).max(12).optional(),
  primaryCategoryId: Id,
  /** Other categories to appear in; the primary one is always included. */
  categoryIds: z.array(Id).max(10),
  attributes: z.array(z.strictObject({ attributeId: Id, valueIds: z.array(Id).max(30).optional(), number: z.int().min(0).max(100_000).optional() })).max(30),
  styleId: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'handle_invalid').max(80).optional(),
  colorway: z.strictObject({ label: z.string().trim().min(1).max(40), family: Enum.colorFamily, swatch: Swatch }).optional(),
  media: z.array(MediaLink).max(12),
  options: z.array(OptionInput).max(3),
  variants: z.array(VariantInput).max(100),
  sizeChartId: Id.optional(),
  customSizeSchemaId: Id.optional(),
  fit: Fit.optional(),
  madeToOrder: z.strictObject({
    leadMinDays: z.int().min(0).max(365),
    leadMaxDays: z.int().min(0).max(365),
    label: text(80).optional(),
    returnable: z.boolean(),
    /** Share paid up front, 0 to 100. Absent means no deposit. */
    depositPercent: z.number().min(0).max(100).multipleOf(0.01).optional(),
  }).optional(),
  bundleProductIds: z.array(Id).max(6).optional(),
  relatedIds: z.array(Id).max(8).optional(),
  badges: z.array(z.enum(productBadges)).max(3).optional(),
  featuredRank: z.int().min(0).max(1000).optional(),
  seo: z.strictObject({ title: text(60).optional(), description: text(160).optional() }).optional(),
  i18n: z.strictObject({
    ur: z.strictObject({
      title: text(120).optional(), subtitle: text(160).optional(), descriptionMd: z.string().max(5000).optional(),
      highlights: z.array(text(120)).max(6).optional(), care: z.array(text(120)).max(8).optional(), colorwayLabel: text(40).optional(),
    }).optional(),
  }).optional(),
})
/** @typedef {z.infer<typeof ProductInput>} ProductInput */

export const PublishCheck = z.strictObject({ code: z.string(), path: z.string().optional(), ok: z.boolean() })

export const AdminProduct = ProductInput.safeExtend({
  id: Id,
  version: z.int().min(1),
  createdAt: IsoDate,
  updatedAt: IsoDate,
  publishedAt: IsoDate.optional(),
  media: z.array(MediaLink.safeExtend({ image: Image.optional() })),
  options: z.array(OptionInput.safeExtend({ id: Id, values: z.array(OptionValueInput.safeExtend({ id: Id })) })),
  variants: z.array(VariantInput.safeExtend({ id: Id, stockStatus: Enum.stockStatus, onHand: z.int().optional(), reserved: z.int().optional(), hasOrders: z.boolean() })),
  siblings: z.array(z.strictObject({ id: Id, handle: z.string(), title: z.string(), colorwayLabel: z.string(), status: Enum.productStatus })),
  collections: z.array(z.strictObject({ id: Id, title: z.string() })),
  checks: z.array(PublishCheck),
  storefrontUrl: z.string().optional(),
})

export const AdminProductRow = z.strictObject({
  id: Id,
  handle: z.string(),
  title: z.string(),
  colorwayLabel: z.string().optional(),
  image: Image.optional(),
  status: Enum.productStatus,
  kind: Enum.productKind,
  primaryCategory: z.strictObject({ id: Id, name: z.string() }),
  variantCount: z.int(),
  stockStatus: Enum.stockStatus,
  quantity: z.int().optional(),
  priceFrom: Money,
  priceTo: Money.optional(),
  updatedAt: IsoDate,
  hasIssues: z.boolean(),
})

// ---- collections -------------------------------------------------------------------------------------------------------------

export const CollectionInput = z.strictObject({
  title: z.string().trim().min(1).max(80),
  handle: Slug,
  description: text(600).optional(),
  imageMediaId: Id.nullable().optional(),
  status: Enum.collectionStatus,
  featured: z.boolean(),
  /** Which featured collection to un-feature when a fourth one is set. */
  replaceFeaturedId: Id.optional(),
  startsAt: IsoDate.optional(),
  endsAt: IsoDate.optional(),
  /** In display order. */
  productIds: z.array(Id).max(500),
  seo: z.strictObject({ title: text(60).optional(), description: text(160).optional() }).optional(),
  i18n: z.strictObject({ ur: z.strictObject({ title: text(80).optional(), description: text(600).optional() }).optional() }).optional(),
})
export const AdminCollectionRow = z.strictObject({
  id: Id, title: z.string(), handle: z.string(), status: Enum.collectionStatus, featured: z.boolean(), productCount: z.int(), updatedAt: IsoDate,
})
export const AdminCollection = CollectionInput.omit({ replaceFeaturedId: true }).safeExtend({
  id: Id, version: z.int().min(1), image: Image.optional(), products: z.array(AdminProductRow), updatedAt: IsoDate,
})

// ---- routes ------------------------------------------------------------------------------------------------------------------

export const productRoutes = defineRoutes({
  'admin.products.list': {
    method: 'GET', path: '/admin/products', auth: 'staff', permission: 'products:read',
    query: PageQuery.extend({
      status: Enum.productStatus.optional(),
      category: Id.optional(),
      collection: Id.optional(),
      kind: Enum.productKind.optional(),
      stock: z.enum(['in', 'low', 'sold_out', 'mto']).optional(),
    }),
    response: Page(AdminProductRow),
  },
  'admin.products.checkSku': {
    method: 'GET', path: '/admin/products/sku-available', auth: 'staff', permission: 'products:read',
    query: z.strictObject({ sku: z.string().trim().min(1).max(40), exceptVariantId: Id.optional() }),
    response: z.strictObject({ available: z.boolean() }),
  },
  'admin.products.checks': {
    method: 'POST', path: '/admin/products/publish-checks', auth: 'staff', permission: 'products:read',
    body: ProductInput, response: z.strictObject({ checks: z.array(PublishCheck) }),
  },
  'admin.products.get': { method: 'GET', path: '/admin/products/:id', auth: 'staff', permission: 'products:read', params: IdParams, response: AdminProduct },
  'admin.products.create': { method: 'POST', path: '/admin/products', auth: 'staff', permission: 'products:write', status: 201, body: ProductInput.safeExtend({ initialStock: InitialStock.optional() }), response: AdminProduct },
  'admin.products.update': { method: 'PUT', path: '/admin/products/:id', auth: 'staff', permission: 'products:write', params: IdParams, body: ProductInput.safeExtend({ version: z.int().min(1) }), response: AdminProduct },
  'admin.products.delete': { method: 'DELETE', path: '/admin/products/:id', auth: 'staff', permission: 'products:delete', params: IdParams, status: 204, response: z.undefined() },
  'admin.products.duplicate': { method: 'POST', path: '/admin/products/:id/duplicate', auth: 'staff', permission: 'products:write', params: IdParams, status: 201, response: AdminProduct },
  'admin.products.bulk': {
    method: 'POST', path: '/admin/products/bulk', auth: 'staff', permission: 'products:publish',
    body: z.strictObject({ ids: z.array(Id).min(1).max(100), action: z.enum(['publish', 'unpublish', 'archive']) }),
    response: BulkResult,
  },
  'admin.products.previewLink': {
    method: 'POST', path: '/admin/products/:id/preview-link', auth: 'staff', permission: 'products:read', params: IdParams,
    response: z.strictObject({ url: z.string(), expiresAt: IsoDate }),
  },

  'admin.collections.list': {
    method: 'GET', path: '/admin/collections', auth: 'staff', permission: 'catalog:read',
    query: PageQuery.extend({ status: Enum.collectionStatus.optional() }), response: Page(AdminCollectionRow),
  },
  'admin.collections.get': { method: 'GET', path: '/admin/collections/:id', auth: 'staff', permission: 'catalog:read', params: IdParams, response: AdminCollection },
  'admin.collections.create': { method: 'POST', path: '/admin/collections', auth: 'staff', permission: 'catalog:write', status: 201, body: CollectionInput, response: AdminCollection },
  'admin.collections.update': { method: 'PUT', path: '/admin/collections/:id', auth: 'staff', permission: 'catalog:write', params: IdParams, body: CollectionInput.safeExtend({ version: z.int().min(1) }), response: AdminCollection },
  'admin.collections.delete': { method: 'DELETE', path: '/admin/collections/:id', auth: 'staff', permission: 'catalog:delete', params: IdParams, status: 204, response: z.undefined() },
})
