// Delivery cities, zones, methods and couriers (plan/09-data-model/09-settings-shipping-content.md section 4).
import { bigint, boolean, check, foreignKey, index, int, json, mysqlTable, primaryKey, smallint, varchar } from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { utc, uuid } from '../types.js'

export const cities = mysqlTable('cities', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 60 }).notNull().unique('cities_name_uq'),
  province: varchar('province', { length: 40 }).notNull(),
  aliases: json('aliases'),
  isMajor: boolean('is_major').notNull().default(false),
  createdAt: utc('created_at').notNull(),
})

export const shippingZones = mysqlTable('shipping_zones', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 60 }).notNull().unique('shipping_zones_name_uq'),
  sortOrder: int('sort_order').notNull().default(0),
  version: int('version').notNull().default(1),
  createdAt: utc('created_at').notNull(),
  updatedAt: utc('updated_at').notNull(),
})

/** A city is in at most one zone: its id is the whole primary key. */
export const shippingZoneCities = mysqlTable(
  'shipping_zone_cities',
  {
    cityId: uuid('city_id').notNull(),
    zoneId: uuid('zone_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.cityId] }),
    index('shipping_zone_cities_zone_idx').on(t.zoneId),
    foreignKey({ name: 'szc_city_fk', columns: [t.cityId], foreignColumns: [cities.id] }).onDelete('cascade'),
    foreignKey({ name: 'szc_zone_fk', columns: [t.zoneId], foreignColumns: [shippingZones.id] }).onDelete('cascade'),
  ],
)

export const shippingMethods = mysqlTable(
  'shipping_methods',
  {
    id: uuid('id').primaryKey(),
    zoneId: uuid('zone_id').notNull(),
    label: varchar('label', { length: 60 }).notNull(),
    feeMinor: bigint('fee_minor', { mode: 'number' }).notNull(),
    freeAboveMinor: bigint('free_above_minor', { mode: 'number' }),
    etaMinDays: smallint('eta_min_days').notNull(),
    etaMaxDays: smallint('eta_max_days').notNull(),
    codAllowed: boolean('cod_allowed').notNull().default(true),
    enabled: boolean('enabled').notNull().default(true),
    sortOrder: int('sort_order').notNull().default(0),
    i18n: json('i18n'),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [
    index('shipping_methods_zone_idx').on(t.zoneId, t.enabled, t.sortOrder),
    foreignKey({ name: 'shipping_methods_zone_fk', columns: [t.zoneId], foreignColumns: [shippingZones.id] }).onDelete('cascade'),
    check('shipping_methods_fee_chk', sql`${t.feeMinor} >= 0`),
    check('shipping_methods_free_chk', sql`${t.freeAboveMinor} is null or ${t.freeAboveMinor} >= 0`),
    check('shipping_methods_eta_chk', sql`${t.etaMinDays} >= 0 and ${t.etaMinDays} <= ${t.etaMaxDays} and ${t.etaMaxDays} <= 60`),
  ],
)

export const couriers = mysqlTable('couriers', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 60 }).notNull().unique('couriers_name_uq'),
  trackingUrlPattern: varchar('tracking_url_pattern', { length: 300 }),
  trackingRequired: boolean('tracking_required').notNull().default(true),
  enabled: boolean('enabled').notNull().default(true),
  sortOrder: int('sort_order').notNull().default(0),
})
