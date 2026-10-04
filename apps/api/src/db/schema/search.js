// Text search over active products (plan/09-data-model/05-search.md). The two FULLTEXT indexes are added by hand in the migration
// (drizzle has no syntax for them), together with the switch that keeps short words like "in" and "for" searchable.
import { date, foreignKey, int, mysqlTable, primaryKey, text, varchar } from 'drizzle-orm/mysql-core'
import { utc, uuid } from '../types.js'
import { products } from './products.js'

export const productSearch = mysqlTable(
  'product_search',
  {
    productId: uuid('product_id').primaryKey(),
    titleText: varchar('title_text', { length: 400 }).notNull(),
    bodyText: text('body_text').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [foreignKey({ name: 'product_search_product_fk', columns: [t.productId], foreignColumns: [products.id] }).onDelete('cascade')],
)

export const searchSynonyms = mysqlTable('search_synonyms', {
  term: varchar('term', { length: 60 }).primaryKey(),
  expandsTo: varchar('expands_to', { length: 200 }).notNull(),
  createdAt: utc('created_at').notNull(),
})

export const searchMisses = mysqlTable(
  'search_misses',
  {
    day: date('day', { mode: 'string' }).notNull(),
    query: varchar('query', { length: 80 }).notNull(),
    count: int('count').notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.day, t.query] })],
)
