// Store settings documents, CMS pages and menus (plan/09-data-model/09-settings-shipping-content.md sections 2-3).
// `page_redirects` is not in the original model: a page whose slug changes keeps answering at the old one (DOC-10.7 section 3).
import { enums } from '@noor/contract'
import { boolean, check, foreignKey, int, json, mediumtext, mysqlTable, varchar } from 'drizzle-orm/mysql-core'
import { binVarchar, utc, uuid } from '../types.js'
import { inList, staffUsers } from './auth.js'

export const settings = mysqlTable(
  'settings',
  {
    key: binVarchar('key', { length: 32 }).primaryKey(),
    value: json('value').notNull(),
    version: int('version').notNull().default(1),
    updatedAt: utc('updated_at').notNull(),
    updatedBy: uuid('updated_by'),
  },
  (t) => [foreignKey({ name: 'settings_updated_by_fk', columns: [t.updatedBy], foreignColumns: [staffUsers.id] }).onDelete('set null')],
)

export const pages = mysqlTable(
  'pages',
  {
    id: uuid('id').primaryKey(),
    slug: binVarchar('slug', { length: 80 }).notNull().unique('pages_slug_uq'),
    title: varchar('title', { length: 100 }).notNull(),
    bodyMd: mediumtext('body_md').notNull(),
    status: binVarchar('status', { length: 16 }).notNull().default('draft'),
    locked: boolean('locked').notNull().default(false),
    seoTitle: varchar('seo_title', { length: 60 }),
    seoDescription: varchar('seo_description', { length: 160 }),
    i18n: json('i18n'),
    version: int('version').notNull().default(1),
    updatedBy: uuid('updated_by'),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [
    foreignKey({ name: 'pages_updated_by_fk', columns: [t.updatedBy], foreignColumns: [staffUsers.id] }).onDelete('set null'),
    check('pages_status_chk', inList(t.status, enums.pageStatus)),
  ],
)

export const pageRedirects = mysqlTable(
  'page_redirects',
  {
    oldSlug: binVarchar('old_slug', { length: 80 }).primaryKey(),
    pageId: uuid('page_id').notNull(),
  },
  (t) => [foreignKey({ name: 'page_redirects_page_fk', columns: [t.pageId], foreignColumns: [pages.id] }).onDelete('cascade')],
)

export const menus = mysqlTable(
  'menus',
  {
    handle: binVarchar('handle', { length: 16 }).primaryKey(),
    items: json('items').notNull(),
    version: int('version').notNull().default(1),
    updatedAt: utc('updated_at').notNull(),
    updatedBy: uuid('updated_by'),
  },
  (t) => [foreignKey({ name: 'menus_updated_by_fk', columns: [t.updatedBy], foreignColumns: [staffUsers.id] }).onDelete('set null')],
)
