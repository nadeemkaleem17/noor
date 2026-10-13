// Catalog structure: categories, attributes, size systems, size charts and custom-size forms (admin side;
// plan/10-api/05-admin-catalog.md sections 5 and 7, plan/09-data-model/03-catalog.md sections 3-4).
import { z } from 'zod'
import { Slug } from './content.js'
import { Enum } from './enum-schemas.js'
import { FormField, Id, Image, IsoDate, Swatch } from './primitives.js'
import { defineRoutes } from './routes.js'

const IdParams = z.strictObject({ id: Id })
const text = (/** @type {number} */ max) => z.string().trim().max(max)
const Urdu = (/** @type {z.ZodRawShape} */ shape) => z.strictObject({ ur: z.strictObject(shape).optional() }).optional()

// ---- categories --------------------------------------------------------------------------------------------------------------

export const maxCategoryDepth = 3

export const CategoryInput = z.strictObject({
  name: z.string().trim().min(1).max(60),
  handle: Slug,
  parentId: Id.nullable().optional(),
  description: text(600).optional(),
  imageMediaId: Id.nullable().optional(),
  visible: z.boolean(),
  /** Filters of the category, in facet order. Empty means "use the parent's". */
  attributes: z.array(z.strictObject({ attributeId: Id, seoIndexable: z.boolean(), required: z.boolean() })).max(20),
  seo: z.strictObject({ title: text(60).optional(), description: text(160).optional() }).optional(),
  i18n: Urdu({ name: text(60).optional(), description: text(600).optional() }),
})
export const AdminCategory = CategoryInput.safeExtend({
  id: Id, sortOrder: z.int(), productCount: z.int(), image: Image.optional(), version: z.int().min(1),
})

// ---- attributes --------------------------------------------------------------------------------------------------------------

export const AttributeValueInput = z.strictObject({
  id: Id.optional(),
  code: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/, 'code_invalid'),
  label: z.string().trim().min(1).max(60),
  swatch: Swatch.optional(),
  i18n: Urdu({ label: text(60).optional() }),
})

export const AttributeInput = z.strictObject({
  code: z.string().regex(/^[a-z][a-z0-9_]{0,29}$/, 'code_invalid'),
  label: z.string().trim().min(1).max(60),
  type: Enum.attributeType,
  display: Enum.attributeDisplay,
  filterable: z.boolean(),
  group: text(60).optional(),
  /** Only for `enum` and `color`; `boolean` and `number` attributes get their fixed values from the server. */
  values: z.array(AttributeValueInput).max(200),
  i18n: Urdu({ label: text(60).optional() }),
}).refine((a) => a.display !== 'range' || a.type === 'number', { message: 'invalid_format', path: ['display'] })
  .refine((a) => a.display !== 'swatch' || a.type === 'color', { message: 'invalid_format', path: ['display'] })

export const AdminAttribute = z.strictObject({
  id: Id,
  code: z.string(),
  label: z.string(),
  type: Enum.attributeType,
  display: Enum.attributeDisplay,
  filterable: z.boolean(),
  group: z.string().optional(),
  values: z.array(AttributeValueInput.safeExtend({ id: Id, usedByProducts: z.int() })),
  i18n: Urdu({ label: text(60).optional() }),
  usedByProducts: z.int(),
  usedByCategories: z.int(),
})

// ---- sizes -------------------------------------------------------------------------------------------------------------------

export const SizeSystemInput = z.strictObject({
  name: z.string().trim().min(1).max(60),
  /** Order is size order. */
  values: z.array(z.strictObject({ id: Id.optional(), label: z.string().trim().min(1).max(10) })).min(1).max(40),
})
export const AdminSizeSystem = z.strictObject({
  id: Id, name: z.string(), values: z.array(z.strictObject({ id: Id, label: z.string(), usedByVariants: z.int() })),
})

export const SizeChartTable = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, 'handle_invalid'),
  title: z.string().trim().min(1).max(60),
  columns: z.array(z.string().trim().min(1).max(30)).min(1).max(12),
  rows: z.array(z.strictObject({ label: z.string().trim().min(1).max(20), values: z.array(z.number().min(0).max(1000)).max(12) })).min(1).max(40),
})
export const SizeChartInput = z.strictObject({
  title: z.string().trim().min(1).max(100),
  sizeSystemId: Id.nullable().optional(),
  unit: z.enum(['in', 'cm']),
  notes: text(400).optional(),
  guideMediaId: Id.nullable().optional(),
  tables: z.array(SizeChartTable).min(1).max(4),
  i18n: Urdu({ title: text(100).optional(), notes: text(400).optional() }),
})
export const AdminSizeChart = SizeChartInput.safeExtend({ id: Id, version: z.int().min(1), usedBy: z.int(), guideImage: Image.optional(), updatedAt: IsoDate })

// ---- custom-size forms -------------------------------------------------------------------------------------------------------

export const FormSchemaInput = z.strictObject({
  title: z.string().trim().min(1).max(100),
  fields: z.array(FormField).min(1).max(30),
  allowNotes: z.boolean(),
})
export const AdminFormSchema = FormSchemaInput.safeExtend({ id: Id, version: z.int().min(1), usedBy: z.int(), updatedAt: IsoDate })

// ---- routes ------------------------------------------------------------------------------------------------------------------

const Items = (/** @type {z.ZodType} */ item) => z.strictObject({ items: z.array(item) })

export const taxonomyRoutes = defineRoutes({
  'admin.categories.list': { method: 'GET', path: '/admin/categories', auth: 'staff', permission: 'catalog:read', response: Items(AdminCategory) },
  'admin.categories.create': { method: 'POST', path: '/admin/categories', auth: 'staff', permission: 'catalog:write', status: 201, body: CategoryInput, response: AdminCategory },
  'admin.categories.reorder': {
    method: 'POST', path: '/admin/categories/reorder', auth: 'staff', permission: 'catalog:write', status: 204,
    body: z.strictObject({ parentId: Id.nullable(), orderedIds: z.array(Id).min(1).max(200) }), response: z.undefined(),
  },
  'admin.categories.update': { method: 'PUT', path: '/admin/categories/:id', auth: 'staff', permission: 'catalog:write', params: IdParams, body: CategoryInput.safeExtend({ version: z.int().min(1) }), response: AdminCategory },
  'admin.categories.delete': { method: 'DELETE', path: '/admin/categories/:id', auth: 'staff', permission: 'catalog:delete', params: IdParams, status: 204, response: z.undefined() },

  'admin.attributes.list': { method: 'GET', path: '/admin/attributes', auth: 'staff', permission: 'catalog:read', response: Items(AdminAttribute) },
  'admin.attributes.create': { method: 'POST', path: '/admin/attributes', auth: 'staff', permission: 'catalog:write', status: 201, body: AttributeInput, response: AdminAttribute },
  'admin.attributes.update': { method: 'PUT', path: '/admin/attributes/:id', auth: 'staff', permission: 'catalog:write', params: IdParams, body: AttributeInput, response: AdminAttribute },
  'admin.attributes.mergeValue': {
    method: 'POST', path: '/admin/attributes/:id/values/:valueId/merge', auth: 'staff', permission: 'catalog:write', status: 204,
    params: z.strictObject({ id: Id, valueId: Id }), body: z.strictObject({ intoValueId: Id }), response: z.undefined(),
  },
  'admin.attributes.delete': { method: 'DELETE', path: '/admin/attributes/:id', auth: 'staff', permission: 'catalog:delete', params: IdParams, status: 204, response: z.undefined() },

  'admin.sizeSystems.list': { method: 'GET', path: '/admin/size-systems', auth: 'staff', permission: 'catalog:read', response: Items(AdminSizeSystem) },
  'admin.sizeSystems.create': { method: 'POST', path: '/admin/size-systems', auth: 'staff', permission: 'catalog:write', status: 201, body: SizeSystemInput, response: AdminSizeSystem },
  'admin.sizeSystems.update': { method: 'PUT', path: '/admin/size-systems/:id', auth: 'staff', permission: 'catalog:write', params: IdParams, body: SizeSystemInput, response: AdminSizeSystem },
  'admin.sizeSystems.delete': { method: 'DELETE', path: '/admin/size-systems/:id', auth: 'staff', permission: 'catalog:delete', params: IdParams, status: 204, response: z.undefined() },

  'admin.sizeCharts.list': { method: 'GET', path: '/admin/size-charts', auth: 'staff', permission: 'catalog:read', response: Items(AdminSizeChart) },
  'admin.sizeCharts.get': { method: 'GET', path: '/admin/size-charts/:id', auth: 'staff', permission: 'catalog:read', params: IdParams, response: AdminSizeChart },
  'admin.sizeCharts.create': { method: 'POST', path: '/admin/size-charts', auth: 'staff', permission: 'catalog:write', status: 201, body: SizeChartInput, response: AdminSizeChart },
  'admin.sizeCharts.update': { method: 'PUT', path: '/admin/size-charts/:id', auth: 'staff', permission: 'catalog:write', params: IdParams, body: SizeChartInput.safeExtend({ version: z.int().min(1) }), response: AdminSizeChart },
  'admin.sizeCharts.delete': { method: 'DELETE', path: '/admin/size-charts/:id', auth: 'staff', permission: 'catalog:delete', params: IdParams, status: 204, response: z.undefined() },

  'admin.formSchemas.list': { method: 'GET', path: '/admin/form-schemas', auth: 'staff', permission: 'catalog:read', response: Items(AdminFormSchema) },
  'admin.formSchemas.get': { method: 'GET', path: '/admin/form-schemas/:id', auth: 'staff', permission: 'catalog:read', params: IdParams, response: AdminFormSchema },
  'admin.formSchemas.create': { method: 'POST', path: '/admin/form-schemas', auth: 'staff', permission: 'catalog:write', status: 201, body: FormSchemaInput, response: AdminFormSchema },
  'admin.formSchemas.update': { method: 'PUT', path: '/admin/form-schemas/:id', auth: 'staff', permission: 'catalog:write', params: IdParams, body: FormSchemaInput.safeExtend({ version: z.int().min(1) }), response: AdminFormSchema },
  'admin.formSchemas.delete': { method: 'DELETE', path: '/admin/form-schemas/:id', auth: 'staff', permission: 'catalog:delete', params: IdParams, status: 204, response: z.undefined() },
})
