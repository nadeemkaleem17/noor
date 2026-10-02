// `resource:action` permissions (plan/11-security-auth.md section 4). The role -> permission matrix lives in the API
// (modules/auth/roles.ts); the vocabulary lives here so a route table cannot name a permission that does not exist.
import { z } from 'zod'

export const permissions = [
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
] as const

export type Permission = (typeof permissions)[number]
export const Permission = z.enum(permissions)
