// CMS pages, menus and link search, admin and public (plan/10-api/07 sections 3-4, plan/10-api/01).
import { z } from 'zod'
import { Enum } from './enums.js'
import { Link, LocaleQuery } from './settings.js'
import { Page, PageQuery } from './pagination.js'
import { Id, IsoDate } from './primitives.js'
import { defineRoutes } from './routes.js'

export const MenuHandle = z.enum(['main', 'footer'])
/** Limits per menu (DOC-07.9 section 4): levels, top-level items, children per item. */
export const menuLimits = /** @type {const} */ ({ main: { levels: 2, top: 8, children: 12 }, footer: { levels: 1, top: 10, children: 0 } })

export const Slug = z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'handle_invalid')

export const PageInput = z.strictObject({
  title: z.string().trim().min(1).max(100),
  slug: Slug,
  bodyMd: z.string().max(50_000),
  status: Enum.pageStatus,
  seo: z.strictObject({ title: z.string().trim().max(60).optional(), description: z.string().trim().max(160).optional() }).optional(),
  i18n: z.strictObject({ ur: z.strictObject({ title: z.string().trim().max(100).optional(), bodyMd: z.string().max(50_000).optional() }).optional() }).optional(),
})
/** @typedef {z.infer<typeof PageInput>} PageInput */

export const AdminPage = PageInput.extend({
  id: Id,
  locked: z.boolean(),
  version: z.int().min(1),
  updatedAt: IsoDate,
  updatedBy: z.string().optional(),
  storefrontUrl: z.string(),
})
export const AdminPageRow = z.strictObject({ id: Id, title: z.string(), slug: z.string(), status: Enum.pageStatus, locked: z.boolean(), updatedAt: IsoDate, updatedBy: z.string().optional() })

/** @typedef {{ id?: string, label: string, href: string, i18n?: { ur?: { label?: string } }, children?: MenuItemInput[] }} MenuItemInput */
/** @type {z.ZodType<MenuItemInput>} */
export const MenuItemInput = z.lazy(() =>
  z.strictObject({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, 'handle_invalid').optional(),
    label: z.string().trim().min(1).max(30),
    href: Link,
    i18n: z.strictObject({ ur: z.strictObject({ label: z.string().trim().max(30).optional() }).optional() }).optional(),
    children: z.array(MenuItemInput).max(12).optional(),
  }),
)

/** @typedef {{ id: string, label: string, href: string, i18n?: { ur?: { label?: string } }, targetLive: boolean, children?: AdminMenuItem[] }} AdminMenuItem */
/** @type {z.ZodType<AdminMenuItem>} */
const AdminMenuItem = z.lazy(() =>
  z.strictObject({
    id: z.string(),
    label: z.string(),
    href: z.string(),
    i18n: z.strictObject({ ur: z.strictObject({ label: z.string().optional() }).optional() }).optional(),
    targetLive: z.boolean(),
    children: z.array(AdminMenuItem).optional(),
  }),
)
export const AdminMenu = z.strictObject({ handle: MenuHandle, version: z.int().min(0), items: z.array(AdminMenuItem) })

const IdParams = z.strictObject({ id: Id })
const HandleParams = z.strictObject({ handle: MenuHandle })

export const LinkTarget = z.strictObject({ type: z.enum(['category', 'collection', 'product', 'page', 'static']), label: z.string(), href: z.string() })

export const contentRoutes = defineRoutes({
  'admin.pages.list': {
    method: 'GET', path: '/admin/pages', auth: 'staff', permission: 'content:read',
    query: PageQuery.extend({ status: Enum.pageStatus.optional() }),
    response: Page(AdminPageRow),
  },
  'admin.pages.preview': { method: 'POST', path: '/admin/pages/preview', auth: 'staff', permission: 'content:read', body: z.strictObject({ bodyMd: z.string().max(50_000) }), response: z.strictObject({ bodyMd: z.string() }) },
  'admin.pages.get': { method: 'GET', path: '/admin/pages/:id', auth: 'staff', permission: 'content:read', params: IdParams, response: AdminPage },
  'admin.pages.create': { method: 'POST', path: '/admin/pages', auth: 'staff', permission: 'content:write', status: 201, body: PageInput, response: AdminPage },
  'admin.pages.update': { method: 'PUT', path: '/admin/pages/:id', auth: 'staff', permission: 'content:write', params: IdParams, body: PageInput.extend({ version: z.int().min(1) }), response: AdminPage },
  'admin.pages.delete': { method: 'DELETE', path: '/admin/pages/:id', auth: 'staff', permission: 'content:delete', params: IdParams, status: 204, response: z.undefined() },
  'admin.menus.get': { method: 'GET', path: '/admin/menus/:handle', auth: 'staff', permission: 'content:read', params: HandleParams, response: AdminMenu },
  'admin.menus.update': {
    method: 'PUT', path: '/admin/menus/:handle', auth: 'staff', permission: 'content:write', params: HandleParams,
    body: z.strictObject({ items: z.array(MenuItemInput).max(12), version: z.int().min(0) }),
    response: AdminMenu,
  },
  'admin.links.search': {
    method: 'GET', path: '/admin/links', auth: 'staff', permission: 'content:read',
    query: z.strictObject({ q: z.string().trim().min(2).max(80) }),
    response: z.strictObject({ items: z.array(LinkTarget).max(20) }),
  },
})

// ---- public -----------------------------------------------------------------------------------------------------------------

/** @typedef {{ id: string, label: string, href: string, children?: MenuItemPublic[] }} MenuItemPublic */
/** @type {z.ZodType<MenuItemPublic>} */
const MenuItemPublic = z.lazy(() => z.strictObject({ id: z.string(), label: z.string(), href: z.string(), children: z.array(MenuItemPublic).optional() }))

export const PagePublic = z.strictObject({
  slug: z.string(),
  title: z.string(),
  bodyMd: z.string(),
  seo: z.strictObject({ title: z.string().optional(), description: z.string().optional() }),
  updatedAt: IsoDate,
  /** The language the body is actually in: English when the Urdu text is missing. */
  locale: Enum.locale,
})

export const contentPublicRoutes = defineRoutes({
  'content.getMenu': { method: 'GET', path: '/content/menus/:handle', auth: 'public', cache: 'shared', params: HandleParams, query: LocaleQuery, response: z.strictObject({ handle: MenuHandle, items: z.array(MenuItemPublic) }) },
  'content.getPage': {
    method: 'GET', path: '/content/pages/:slug', auth: 'public', cache: 'shared', params: z.strictObject({ slug: Slug }), query: LocaleQuery,
    response: z.union([PagePublic, z.strictObject({ redirectTo: z.string() })]),
  },
  'content.listPages': {
    method: 'GET', path: '/content/pages', auth: 'public', cache: 'shared',
    response: z.strictObject({ items: z.array(z.strictObject({ slug: z.string(), title: z.string(), updatedAt: IsoDate })) }),
  },
})
