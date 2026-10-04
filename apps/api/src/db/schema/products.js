// Products, their options and variants, media links, collections, bundles and related items
// (plan/09-data-model/03-catalog.md sections 5 and 6). Stock lives in inventory tables (M1-10), never here.
import { enums } from '@noor/contract'
import { sql } from 'drizzle-orm'
import { bigint, boolean, check, date, foreignKey, index, int, json, mysqlTable, primaryKey, smallint, text, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import { binVarchar, utc, uuid } from '../types.js'
import { inList } from './auth.js'
import { media } from './media.js'
import { attributeValues, attributes, categories, formSchemas, sizeCharts, sizeSystemValues, sizeSystems } from './taxonomy.js'

export const products = mysqlTable(
  'products',
  {
    id: uuid('id').primaryKey(),
    handle: binVarchar('handle', { length: 80 }).notNull().unique('products_handle_uq'),
    status: binVarchar('status', { length: 16 }).notNull().default('draft'),
    publishAt: utc('publish_at'),
    publishedAt: utc('published_at'),
    kind: binVarchar('kind', { length: 16 }).notNull(),
    title: varchar('title', { length: 120 }).notNull(),
    subtitle: varchar('subtitle', { length: 160 }),
    brand: varchar('brand', { length: 60 }),
    descriptionMd: text('description_md'),
    highlights: json('highlights'),
    care: json('care'),
    components: json('components'),
    primaryCategoryId: uuid('primary_category_id').notNull(),
    styleId: binVarchar('style_id', { length: 80 }),
    colorwayLabel: varchar('colorway_label', { length: 40 }),
    colorFamily: binVarchar('color_family', { length: 16 }),
    colorwaySwatch: json('colorway_swatch'),
    sizeChartId: uuid('size_chart_id'),
    customSizeSchemaId: uuid('custom_size_schema_id'),
    fit: json('fit'),
    mtoLeadMinDays: smallint('mto_lead_min_days'),
    mtoLeadMaxDays: smallint('mto_lead_max_days'),
    mtoLeadLabel: varchar('mto_lead_label', { length: 80 }),
    mtoReturnable: boolean('mto_returnable'),
    mtoDepositBps: int('mto_deposit_bps'),
    badges: json('badges'),
    seoTitle: varchar('seo_title', { length: 60 }),
    seoDescription: varchar('seo_description', { length: 160 }),
    i18n: json('i18n'),
    // derived by recomputeProductCache, never written by hand
    priceMinMinor: bigint('price_min_minor', { mode: 'number' }).notNull().default(0),
    priceMaxMinor: bigint('price_max_minor', { mode: 'number' }).notNull().default(0),
    compareAtMinMinor: bigint('compare_at_min_minor', { mode: 'number' }),
    stockStatus: binVarchar('stock_status', { length: 16 }).notNull().default('sold_out'),
    salesCount: int('sales_count').notNull().default(0),
    ratingAvgX100: smallint('rating_avg_x100'),
    ratingCount: int('rating_count').notNull().default(0),
    featuredRank: int('featured_rank').notNull().default(0),
    version: int('version').notNull().default(1),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [
    index('products_status_published_idx').on(t.status, t.publishedAt),
    index('products_status_price_idx').on(t.status, t.priceMinMinor),
    index('products_status_sales_idx').on(t.status, t.salesCount),
    index('products_primary_category_idx').on(t.primaryCategoryId, t.status),
    index('products_style_idx').on(t.styleId),
    index('products_kind_idx').on(t.kind, t.status),
    index('products_publish_at_idx').on(t.status, t.publishAt),
    index('products_updated_idx').on(t.updatedAt),
    foreignKey({ name: 'products_primary_category_fk', columns: [t.primaryCategoryId], foreignColumns: [categories.id] }),
    foreignKey({ name: 'products_size_chart_fk', columns: [t.sizeChartId], foreignColumns: [sizeCharts.id] }).onDelete('set null'),
    foreignKey({ name: 'products_custom_size_fk', columns: [t.customSizeSchemaId], foreignColumns: [formSchemas.id] }),
    check('products_status_chk', inList(t.status, enums.productStatus)),
    check('products_kind_chk', inList(t.kind, enums.productKind)),
    check('products_mto_chk', sql`${t.mtoLeadMinDays} is null or ${t.mtoLeadMinDays} <= ${t.mtoLeadMaxDays}`),
    check('products_colorway_chk', sql`${t.styleId} is null or ${t.colorwayLabel} is not null`),
    check('products_price_chk', sql`${t.priceMinMinor} <= ${t.priceMaxMinor}`),
  ],
)

export const productCategories = mysqlTable(
  'product_categories',
  { productId: uuid('product_id').notNull(), categoryId: uuid('category_id').notNull() },
  (t) => [
    primaryKey({ columns: [t.productId, t.categoryId] }),
    index('product_categories_category_idx').on(t.categoryId, t.productId),
    foreignKey({ name: 'product_categories_product_fk', columns: [t.productId], foreignColumns: [products.id] }).onDelete('cascade'),
    foreignKey({ name: 'product_categories_category_fk', columns: [t.categoryId], foreignColumns: [categories.id] }),
  ],
)

export const productOptions = mysqlTable(
  'product_options',
  {
    id: uuid('id').primaryKey(),
    productId: uuid('product_id').notNull(),
    name: varchar('name', { length: 40 }).notNull(),
    role: binVarchar('role', { length: 16 }).notNull(),
    display: binVarchar('display', { length: 16 }).notNull().default('buttons'),
    sizeSystemId: uuid('size_system_id'),
    sortOrder: int('sort_order').notNull(),
    i18n: json('i18n'),
  },
  (t) => [
    index('product_options_product_idx').on(t.productId, t.sortOrder),
    foreignKey({ name: 'product_options_product_fk', columns: [t.productId], foreignColumns: [products.id] }).onDelete('cascade'),
    foreignKey({ name: 'product_options_size_system_fk', columns: [t.sizeSystemId], foreignColumns: [sizeSystems.id] }),
    check('product_options_role_chk', inList(t.role, enums.optionRole)),
    check('product_options_display_chk', inList(t.display, enums.optionDisplay)),
  ],
)

export const productOptionValues = mysqlTable(
  'product_option_values',
  {
    id: uuid('id').primaryKey(),
    optionId: uuid('option_id').notNull(),
    label: varchar('label', { length: 40 }).notNull(),
    kind: binVarchar('kind', { length: 16 }).notNull().default('standard'),
    sizeSystemValueId: uuid('size_system_value_id'),
    swatch: json('swatch'),
    sortOrder: int('sort_order').notNull(),
    i18n: json('i18n'),
  },
  (t) => [
    uniqueIndex('product_option_values_label_uq').on(t.optionId, t.label),
    foreignKey({ name: 'pov_option_fk', columns: [t.optionId], foreignColumns: [productOptions.id] }).onDelete('cascade'),
    foreignKey({ name: 'pov_size_value_fk', columns: [t.sizeSystemValueId], foreignColumns: [sizeSystemValues.id] }),
    check('product_option_values_kind_chk', inList(t.kind, enums.optionValueKind)),
  ],
)

export const productMedia = mysqlTable(
  'product_media',
  {
    productId: uuid('product_id').notNull(),
    mediaId: uuid('media_id').notNull(),
    sortOrder: int('sort_order').notNull(),
    role: binVarchar('role', { length: 16 }),
    alt: varchar('alt', { length: 300 }),
    optionValueId: uuid('option_value_id'),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.mediaId] }),
    index('product_media_order_idx').on(t.productId, t.sortOrder),
    foreignKey({ name: 'product_media_product_fk', columns: [t.productId], foreignColumns: [products.id] }).onDelete('cascade'),
    foreignKey({ name: 'product_media_media_fk', columns: [t.mediaId], foreignColumns: [media.id] }),
    foreignKey({ name: 'product_media_option_value_fk', columns: [t.optionValueId], foreignColumns: [productOptionValues.id] }).onDelete('set null'),
  ],
)

export const variants = mysqlTable(
  'variants',
  {
    id: uuid('id').primaryKey(),
    productId: uuid('product_id').notNull(),
    sku: binVarchar('sku', { length: 40 }).notNull().unique('variants_sku_uq'),
    optionKey: binVarchar('option_key', { length: 120 }).notNull().default(''),
    priceMinor: bigint('price_minor', { mode: 'number' }).notNull(),
    compareAtMinor: bigint('compare_at_minor', { mode: 'number' }),
    stockMode: binVarchar('stock_mode', { length: 16 }).notNull().default('counted'),
    preorderShipsAt: date('preorder_ships_at', { mode: 'string' }),
    maxPerOrder: smallint('max_per_order').notNull().default(10),
    enabled: boolean('enabled').notNull().default(true),
    sortOrder: int('sort_order').notNull().default(0),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('variants_product_option_uq').on(t.productId, t.optionKey),
    index('variants_product_idx').on(t.productId, t.sortOrder),
    foreignKey({ name: 'variants_product_fk', columns: [t.productId], foreignColumns: [products.id] }).onDelete('cascade'),
    check('variants_price_chk', sql`${t.priceMinor} > 0`),
    check('variants_compare_chk', sql`${t.compareAtMinor} is null or ${t.compareAtMinor} > ${t.priceMinor}`),
    check('variants_stock_mode_chk', inList(t.stockMode, enums.stockMode)),
    check('variants_max_chk', sql`${t.maxPerOrder} between 1 and 99`),
  ],
)

export const variantOptionValues = mysqlTable(
  'variant_option_values',
  { variantId: uuid('variant_id').notNull(), optionValueId: uuid('option_value_id').notNull() },
  (t) => [
    primaryKey({ columns: [t.variantId, t.optionValueId] }),
    index('variant_option_values_value_idx').on(t.optionValueId),
    foreignKey({ name: 'vov_variant_fk', columns: [t.variantId], foreignColumns: [variants.id] }).onDelete('cascade'),
    foreignKey({ name: 'vov_value_fk', columns: [t.optionValueId], foreignColumns: [productOptionValues.id] }).onDelete('cascade'),
  ],
)

/** The sizes a product is sold in, derived by recomputeProductCache: one row per size value of an enabled variant. Drives the size filter and facet without joining every variant. */
export const productSizes = mysqlTable(
  'product_sizes',
  { productId: uuid('product_id').notNull(), sizeSystemValueId: uuid('size_system_value_id').notNull(), inStock: boolean('in_stock').notNull() },
  (t) => [
    primaryKey({ columns: [t.productId, t.sizeSystemValueId] }),
    index('product_sizes_value_idx').on(t.sizeSystemValueId, t.inStock, t.productId),
    foreignKey({ name: 'ps_product_fk', columns: [t.productId], foreignColumns: [products.id] }).onDelete('cascade'),
    foreignKey({ name: 'ps_size_fk', columns: [t.sizeSystemValueId], foreignColumns: [sizeSystemValues.id] }),
  ],
)

export const productAttributeValues = mysqlTable(
  'product_attribute_values',
  {
    productId: uuid('product_id').notNull(),
    attributeId: uuid('attribute_id').notNull(),
    valueId: uuid('value_id').notNull(),
    valueNumber: int('value_number'),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.attributeId, t.valueId] }),
    index('product_attribute_values_facet_idx').on(t.attributeId, t.valueId, t.productId),
    foreignKey({ name: 'pav_product_fk', columns: [t.productId], foreignColumns: [products.id] }).onDelete('cascade'),
    foreignKey({ name: 'pav_attribute_fk', columns: [t.attributeId], foreignColumns: [attributes.id] }),
    foreignKey({ name: 'pav_value_fk', columns: [t.valueId], foreignColumns: [attributeValues.id] }),
  ],
)

export const collections = mysqlTable(
  'collections',
  {
    id: uuid('id').primaryKey(),
    handle: binVarchar('handle', { length: 80 }).notNull().unique('collections_handle_uq'),
    title: varchar('title', { length: 80 }).notNull(),
    description: varchar('description', { length: 600 }).notNull().default(''),
    imageMediaId: uuid('image_media_id'),
    status: binVarchar('status', { length: 16 }).notNull().default('draft'),
    featured: boolean('featured').notNull().default(false),
    startsAt: utc('starts_at'),
    endsAt: utc('ends_at'),
    seoTitle: varchar('seo_title', { length: 60 }),
    seoDescription: varchar('seo_description', { length: 160 }),
    i18n: json('i18n'),
    version: int('version').notNull().default(1),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [
    foreignKey({ name: 'collections_image_fk', columns: [t.imageMediaId], foreignColumns: [media.id] }),
    check('collections_status_chk', inList(t.status, enums.collectionStatus)),
  ],
)

export const collectionProducts = mysqlTable(
  'collection_products',
  { collectionId: uuid('collection_id').notNull(), productId: uuid('product_id').notNull(), sortOrder: int('sort_order').notNull() },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.productId] }),
    index('collection_products_order_idx').on(t.collectionId, t.sortOrder),
    index('collection_products_product_idx').on(t.productId),
    foreignKey({ name: 'cp_collection_fk', columns: [t.collectionId], foreignColumns: [collections.id] }).onDelete('cascade'),
    foreignKey({ name: 'cp_product_fk', columns: [t.productId], foreignColumns: [products.id] }).onDelete('cascade'),
  ],
)

export const bundleItems = mysqlTable(
  'bundle_items',
  { bundleProductId: uuid('bundle_product_id').notNull(), childProductId: uuid('child_product_id').notNull(), sortOrder: int('sort_order').notNull() },
  (t) => [
    primaryKey({ columns: [t.bundleProductId, t.childProductId] }),
    foreignKey({ name: 'bundle_items_bundle_fk', columns: [t.bundleProductId], foreignColumns: [products.id] }).onDelete('cascade'),
    foreignKey({ name: 'bundle_items_child_fk', columns: [t.childProductId], foreignColumns: [products.id] }),
    check('bundle_items_self_chk', sql`${t.bundleProductId} <> ${t.childProductId}`),
  ],
)

export const productRelated = mysqlTable(
  'product_related',
  { productId: uuid('product_id').notNull(), relatedProductId: uuid('related_product_id').notNull(), sortOrder: int('sort_order').notNull() },
  (t) => [
    primaryKey({ columns: [t.productId, t.relatedProductId] }),
    foreignKey({ name: 'product_related_product_fk', columns: [t.productId], foreignColumns: [products.id] }).onDelete('cascade'),
    foreignKey({ name: 'product_related_related_fk', columns: [t.relatedProductId], foreignColumns: [products.id] }).onDelete('cascade'),
  ],
)

