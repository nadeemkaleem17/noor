// `resource:action` permissions (plan/11-security-auth.md section 4). The role -> permission matrix lives in the API
// (modules/auth/roles.ts); the vocabulary lives here so a route table cannot name a permission that does not exist.
import { z } from 'zod'

export const permissions = /** @type {const} */ ([
  'dashboard:read',
  'products:read', 'products:write', 'products:publish', 'products:delete', 'products:export',
  'inventory:adjust',
  'catalog:read', 'catalog:write', 'catalog:delete',
  'orders:read', 'orders:note', 'orders:confirm', 'orders:edit', 'orders:dispatch', 'orders:deliver',
  'orders:cancel', 'orders:return', 'orders:payments', 'orders:export',
  'customers:read', 'customers:write', 'customers:export', 'customers:anonymise',
  'promos:read', 'promos:write', 'promos:delete',
  'reviews:read', 'reviews:moderate',
  'content:read', 'content:write', 'content:delete',
  'settings:read', 'settings:write', 'settings:manage',
  'staff:read', 'staff:manage',
  'audit:read',
  'deliveries:read', 'deliveries:assign', 'ledger:read', 'ledger:write', 'receipts:void',
])

/**
 * @typedef {(typeof permissions)[number]} Permission
 */
export const Permission = z.enum(permissions)

/**
 * The permissions grouped by the part of the admin they belong to, for the "Module access" screen of a staff member (plan/17-owner-requests-2026-10.md item 11).
 * Every permission is in exactly one module (a test checks).
 */
export const permissionModules = /** @type {const} */ ([
  { id: 'dashboard', label: 'Dashboard', permissions: ['dashboard:read'] },
  { id: 'products', label: 'Products and stock', permissions: ['products:read', 'products:write', 'products:publish', 'products:delete', 'products:export', 'inventory:adjust'] },
  { id: 'catalog', label: 'Categories, collections, attributes and sizes', permissions: ['catalog:read', 'catalog:write', 'catalog:delete'] },
  { id: 'orders', label: 'Orders', permissions: ['orders:read', 'orders:note', 'orders:confirm', 'orders:edit', 'orders:dispatch', 'orders:deliver', 'orders:cancel', 'orders:return', 'orders:payments', 'orders:export'] },
  { id: 'delivery', label: 'Delivery, rider cash and receipts', permissions: ['deliveries:read', 'deliveries:assign', 'ledger:read', 'ledger:write', 'receipts:void'] },
  { id: 'customers', label: 'Customers', permissions: ['customers:read', 'customers:write', 'customers:export', 'customers:anonymise'] },
  { id: 'promos', label: 'Promo codes', permissions: ['promos:read', 'promos:write', 'promos:delete'] },
  { id: 'reviews', label: 'Reviews', permissions: ['reviews:read', 'reviews:moderate'] },
  { id: 'content', label: 'Content: home page, pages, menus, notices', permissions: ['content:read', 'content:write', 'content:delete'] },
  { id: 'settings', label: 'Settings and emails', permissions: ['settings:read', 'settings:write', 'settings:manage'] },
  { id: 'staff', label: 'Staff', permissions: ['staff:read', 'staff:manage'] },
  { id: 'audit', label: 'Audit log', permissions: ['audit:read'] },
])
