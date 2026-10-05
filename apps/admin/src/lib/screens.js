// Every admin URL with its permission (plan/07-admin/01-ia-roles.md section 2). The router and the sidebar are both built from this list.
// A screen with a `group` is a sidebar item; the others are detail or form routes that keep their list item active.
import { Database, FileText, Folders, Gauge, Home, Layers, List, Package, Palette, Ruler, ScrollText, ShieldCheck, ShoppingBag, Star, Store, Tag, Tags, Truck, Users, Wallet } from 'lucide-react'

const products = () => import('@/routes/products')
const product = () => import('@/routes/product')
const productNew = () => import('@/routes/product-new')
const categories = () => import('@/routes/categories')
const attributes = () => import('@/routes/attributes')
const sizes = () => import('@/routes/sizes')
const collections = () => import('@/routes/collections')
const collection = () => import('@/routes/collection')
const collectionNew = () => import('@/routes/collection-new')
const contentHome = () => import('@/routes/content-home')
const pages = () => import('@/routes/pages')
const page = () => import('@/routes/page')
const pageNew = () => import('@/routes/page-new')
const menus = () => import('@/routes/menus')
const settingsStore = () => import('@/routes/settings-store')
const settingsAppearance = () => import('@/routes/settings-appearance')
const settingsShipping = () => import('@/routes/settings-shipping')
const settingsPayments = () => import('@/routes/settings-payments')
const settingsData = () => import('@/routes/settings-data')
const account = () => import('@/routes/account')
const staff = () => import('@/routes/staff')
const staffMember = () => import('@/routes/staff-member')

/** Screens that are not rebuilt yet share one placeholder module; each milestone task swaps in its own. */
const soon = () => import('@/routes/soon')

/**
 * @typedef {object} Screen
 * @property {string} path
 * @property {string} title
 * @property {import('@noor/contract').Permission} [permission] - without one, any signed-in user may open it
 * @property {'Overview' | 'Sales' | 'Catalog' | 'Content' | 'Settings'} [group] - in the sidebar under this heading
 * @property {import('react').ComponentType<{ className?: string; 'aria-hidden'?: boolean; }>} [icon]
 * @property {() => Promise<object>} lazy
 */

/** @type {Screen[]} */
export const screens = [
  { path: '/', title: 'Dashboard', permission: 'dashboard:read', group: 'Overview', icon: Gauge, lazy: soon },

  { path: '/orders', title: 'Orders', permission: 'orders:read', group: 'Sales', icon: ShoppingBag, lazy: soon },
  { path: '/orders/new', title: 'New order', permission: 'orders:edit', lazy: soon },
  { path: '/orders/:id', title: 'Order', permission: 'orders:read', lazy: soon },
  { path: '/customers', title: 'Customers', permission: 'customers:read', group: 'Sales', icon: Users, lazy: soon },
  { path: '/customers/:id', title: 'Customer', permission: 'customers:read', lazy: soon },
  { path: '/promos', title: 'Promo codes', permission: 'promos:read', group: 'Sales', icon: Tag, lazy: soon },
  { path: '/reviews', title: 'Reviews', permission: 'reviews:read', group: 'Sales', icon: Star, lazy: soon },

  { path: '/products', title: 'Products', permission: 'products:read', group: 'Catalog', icon: Package, lazy: products },
  { path: '/products/new', title: 'New product', permission: 'products:write', lazy: productNew },
  { path: '/products/:id', title: 'Product', permission: 'products:read', lazy: product },
  { path: '/categories', title: 'Categories', permission: 'catalog:read', group: 'Catalog', icon: Folders, lazy: categories },
  { path: '/collections', title: 'Collections', permission: 'catalog:read', group: 'Catalog', icon: Layers, lazy: collections },
  { path: '/collections/new', title: 'New collection', permission: 'catalog:write', lazy: collectionNew },
  { path: '/collections/:id', title: 'Collection', permission: 'catalog:read', lazy: collection },
  { path: '/attributes', title: 'Attributes', permission: 'catalog:read', group: 'Catalog', icon: Tags, lazy: attributes },
  { path: '/sizes', title: 'Sizes & charts', permission: 'catalog:read', group: 'Catalog', icon: Ruler, lazy: sizes },

  { path: '/content/home', title: 'Home page', permission: 'content:read', group: 'Content', icon: Home, lazy: contentHome },
  { path: '/content/pages', title: 'Pages', permission: 'content:read', group: 'Content', icon: FileText, lazy: pages },
  { path: '/content/pages/new', title: 'New page', permission: 'content:write', lazy: pageNew },
  { path: '/content/pages/:id', title: 'Page', permission: 'content:read', lazy: page },
  { path: '/content/menus', title: 'Menus', permission: 'content:read', group: 'Content', icon: List, lazy: menus },

  { path: '/settings/store', title: 'Store', permission: 'settings:read', group: 'Settings', icon: Store, lazy: settingsStore },
  { path: '/settings/appearance', title: 'Appearance', permission: 'settings:read', group: 'Settings', icon: Palette, lazy: settingsAppearance },
  { path: '/settings/shipping', title: 'Shipping', permission: 'settings:read', group: 'Settings', icon: Truck, lazy: settingsShipping },
  { path: '/settings/payments', title: 'Payments', permission: 'settings:read', group: 'Settings', icon: Wallet, lazy: settingsPayments },
  { path: '/staff', title: 'Staff & roles', permission: 'staff:read', group: 'Settings', icon: ShieldCheck, lazy: staff },
  { path: '/staff/:id', title: 'Staff member', permission: 'staff:read', lazy: staffMember },
  { path: '/audit', title: 'Audit log', permission: 'audit:read', group: 'Settings', icon: ScrollText, lazy: soon },
  { path: '/settings/data', title: 'Data', permission: 'settings:manage', group: 'Settings', icon: Database, lazy: settingsData },

  { path: '/account', title: 'My account', lazy: account },
]

export const groups = /** @type {const} */ (['Overview', 'Sales', 'Catalog', 'Content', 'Settings'])
