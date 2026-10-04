// Catalog structure: categories, attributes, sizes and forms (plan/09-data-model/03-catalog.md sections 3-4, 6.5).
import { enums } from '@noor/contract'
import { boolean, check, foreignKey, index, int, json, mysqlTable, primaryKey, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import { binVarchar, utc, uuid } from '../types.js'
import { inList } from './auth.js'
import { media } from './media.js'

export const categories = mysqlTable(
  'categories',
  {
    id: uuid('id').primaryKey(),
    parentId: uuid('parent_id'),
    handle: binVarchar('handle', { length: 80 }).notNull().unique('categories_handle_uq'),
    name: varchar('name', { length: 60 }).notNull(),
    description: varchar('description', { length: 600 }).notNull().default(''),
    imageMediaId: uuid('image_media_id'),
    sortOrder: int('sort_order').notNull().default(0),
    visible: boolean('visible').notNull().default(true),
    seoTitle: varchar('seo_title', { length: 60 }),
    seoDescription: varchar('seo_description', { length: 160 }),
    i18n: json('i18n'),
    version: int('version').notNull().default(1),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [
    index('categories_parent_idx').on(t.parentId, t.sortOrder),
    foreignKey({ name: 'categories_parent_fk', columns: [t.parentId], foreignColumns: [t.id] }), // RESTRICT: a parent with children cannot go
    foreignKey({ name: 'categories_image_fk', columns: [t.imageMediaId], foreignColumns: [media.id] }),
  ],
)

export const attributes = mysqlTable(
  'attributes',
  {
    id: uuid('id').primaryKey(),
    code: binVarchar('code', { length: 30 }).notNull().unique('attributes_code_uq'),
    label: varchar('label', { length: 60 }).notNull(),
    type: binVarchar('type', { length: 16 }).notNull(),
    display: binVarchar('display', { length: 16 }).notNull(),
    filterable: boolean('filterable').notNull().default(false),
    groupLabel: varchar('group_label', { length: 60 }),
    sortOrder: int('sort_order').notNull().default(0),
    i18n: json('i18n'),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [check('attributes_type_chk', inList(t.type, enums.attributeType)), check('attributes_display_chk', inList(t.display, enums.attributeDisplay))],
)

export const attributeValues = mysqlTable(
  'attribute_values',
  {
    id: uuid('id').primaryKey(),
    attributeId: uuid('attribute_id').notNull(),
    code: binVarchar('code', { length: 40 }).notNull(),
    label: varchar('label', { length: 60 }).notNull(),
    swatch: json('swatch'),
    sortOrder: int('sort_order').notNull().default(0),
    i18n: json('i18n'),
  },
  (t) => [
    index('attribute_values_attr_idx').on(t.attributeId, t.sortOrder),
    uniqueIndex('attribute_values_code_uq').on(t.attributeId, t.code),
    foreignKey({ name: 'attribute_values_attr_fk', columns: [t.attributeId], foreignColumns: [attributes.id] }).onDelete('cascade'),
  ],
)

export const categoryAttributes = mysqlTable(
  'category_attributes',
  {
    categoryId: uuid('category_id').notNull(),
    attributeId: uuid('attribute_id').notNull(),
    sortOrder: int('sort_order').notNull().default(0),
    seoIndexable: boolean('seo_indexable').notNull().default(false),
    required: boolean('required').notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.categoryId, t.attributeId] }),
    foreignKey({ name: 'category_attributes_category_fk', columns: [t.categoryId], foreignColumns: [categories.id] }).onDelete('cascade'),
    foreignKey({ name: 'category_attributes_attribute_fk', columns: [t.attributeId], foreignColumns: [attributes.id] }), // RESTRICT: an attribute a category uses cannot go
  ],
)

export const sizeSystems = mysqlTable('size_systems', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 60 }).notNull().unique('size_systems_name_uq'),
  createdAt: utc('created_at').notNull(),
  updatedAt: utc('updated_at').notNull(),
})

export const sizeSystemValues = mysqlTable(
  'size_system_values',
  {
    id: uuid('id').primaryKey(),
    sizeSystemId: uuid('size_system_id').notNull(),
    label: varchar('label', { length: 10 }).notNull(),
    sortOrder: int('sort_order').notNull(),
  },
  (t) => [
    uniqueIndex('size_system_values_label_uq').on(t.sizeSystemId, t.label),
    foreignKey({ name: 'size_system_values_system_fk', columns: [t.sizeSystemId], foreignColumns: [sizeSystems.id] }).onDelete('cascade'),
  ],
)

export const sizeCharts = mysqlTable(
  'size_charts',
  {
    id: uuid('id').primaryKey(),
    title: varchar('title', { length: 100 }).notNull(),
    sizeSystemId: uuid('size_system_id'),
    unit: binVarchar('unit', { length: 2 }).notNull(),
    tables: json('tables').notNull(),
    guideMediaId: uuid('guide_media_id'),
    notes: varchar('notes', { length: 400 }),
    i18n: json('i18n'),
    version: int('version').notNull().default(1),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [
    foreignKey({ name: 'size_charts_system_fk', columns: [t.sizeSystemId], foreignColumns: [sizeSystems.id] }).onDelete('set null'),
    foreignKey({ name: 'size_charts_guide_fk', columns: [t.guideMediaId], foreignColumns: [media.id] }),
    check('size_charts_unit_chk', inList(t.unit, ['in', 'cm'])),
  ],
)

export const formSchemas = mysqlTable('form_schemas', {
  id: uuid('id').primaryKey(),
  title: varchar('title', { length: 100 }).notNull(),
  fields: json('fields').notNull(),
  allowNotes: boolean('allow_notes').notNull().default(false),
  i18n: json('i18n'),
  version: int('version').notNull().default(1),
  createdAt: utc('created_at').notNull(),
  updatedAt: utc('updated_at').notNull(),
})

/** The old handle of a renamed product, category, collection or page keeps working (DOC-09.3 section 6.5). */
export const handleRedirects = mysqlTable(
  'handle_redirects',
  {
    entityType: binVarchar('entity_type', { length: 16 }).notNull(),
    oldHandle: binVarchar('old_handle', { length: 80 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    createdAt: utc('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.entityType, t.oldHandle] })],
)
