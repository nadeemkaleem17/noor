// The role -> permission matrix (plan/11-security-auth.md section 4.1). The single source: the API enforces it and
// `admin.roles.list` serves it to the admin UI. There is deliberately no roles table in v1.
import { permissions } from '@noor/contract'

/** @typedef {import('@noor/contract').Permission} Permission */
/** @typedef {import('@noor/contract').StaffRole} StaffRole */

const manager = /** @type {Permission[]} */ ([
  'dashboard:read', 'products:read', 'products:write', 'products:publish', 'products:delete', 'products:export', 'inventory:adjust',
  'catalog:read', 'catalog:write', 'catalog:delete',
  'orders:read', 'orders:note', 'orders:confirm', 'orders:edit', 'orders:dispatch', 'orders:deliver', 'orders:cancel', 'orders:return', 'orders:payments', 'orders:export',
  'customers:read', 'customers:write', 'promos:read', 'promos:write', 'promos:delete', 'reviews:read', 'reviews:moderate',
  'content:read', 'content:write', 'content:delete', 'settings:read', 'settings:write', 'settings:manage', 'staff:read', 'staff:manage', 'audit:read',
])

/** @type {Record<StaffRole, readonly Permission[]>} */
const matrix = {
  // owner has every permission, including any added later
  owner: permissions,
  manager,
  catalog: [
    'dashboard:read', 'products:read', 'products:write', 'products:publish', 'products:export', 'inventory:adjust',
    'catalog:read', 'catalog:write', 'catalog:delete', 'reviews:read', 'content:read', 'content:write',
  ],
  fulfilment: [
    'dashboard:read', 'products:read', 'inventory:adjust', 'catalog:read',
    'orders:read', 'orders:note', 'orders:confirm', 'orders:edit', 'orders:dispatch', 'orders:deliver', 'orders:cancel', 'orders:return', 'orders:payments',
    'customers:read',
  ],
  support: [
    'dashboard:read', 'products:read', 'catalog:read', 'orders:read', 'orders:note', 'customers:read', 'customers:write',
    'promos:read', 'reviews:read', 'reviews:moderate',
  ],
  viewer: ['dashboard:read', 'products:read', 'catalog:read', 'orders:read'],
}

/** Roles that must use two-factor authentication (ADR-0012). */
export const twoFactorRoles = new Set(/** @type {StaffRole[]} */ (['owner', 'manager']))

/** Higher number = more authority; used to stop someone granting a role above their own. */
const rank = /** @type {Record<StaffRole, number>} */ ({ owner: 5, manager: 4, catalog: 2, fulfilment: 2, support: 2, viewer: 1 })

/** Text for the roles screen. */
export const roleInfo = /** @type {Record<StaffRole, { label: string, summary: string }>} */ ({
  owner: { label: 'Owner', summary: 'Everything, including staff, settings and audit. At least one owner always exists.' },
  manager: { label: 'Manager', summary: 'Runs the shop day to day. Can manage staff except owners.' },
  catalog: { label: 'Catalogue', summary: 'Products, stock, categories and content. No orders or customers.' },
  fulfilment: { label: 'Fulfilment', summary: 'Confirms, dispatches, delivers and cancels orders; adjusts stock.' },
  support: { label: 'Support', summary: 'Reads orders and customers, adds notes, moderates reviews.' },
  viewer: { label: 'Viewer', summary: 'Read-only view of the dashboard, products and orders.' },
})

/** @param {StaffRole} role @returns {ReadonlySet<Permission>} */
export const permissionsOf = (role) => new Set(matrix[role])

/** @param {StaffRole} role @param {Permission} permission */
export const roleCan = (role, permission) => matrix[role].includes(permission)

/** @param {StaffRole} role */
export const requiresTwoFactor = (role) => twoFactorRoles.has(role)

/**
 * Whether `actor` may grant, change or remove `target` (DOC-11 section 4.3): only an owner touches owners, and nobody grants above their own level.
 * @param {StaffRole} actor
 * @param {StaffRole} target
 */
export const mayManage = (actor, target) => (target === 'owner' ? actor === 'owner' : rank[actor] >= rank[target] && roleCan(actor, 'staff:manage'))

/** The data served by `admin.roles.list`. @param {boolean} [twoFactorOn] false when the process runs with two-step sign-in switched off (local development) */
export const roleList = (twoFactorOn = true) =>
  /** @type {StaffRole[]} */ (Object.keys(matrix)).map((role) => ({ role, ...roleInfo[role], twoFactorRequired: twoFactorOn && requiresTwoFactor(role), permissions: [...matrix[role]] }))
