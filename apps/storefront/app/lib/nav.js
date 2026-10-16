// The main navigation as the header shows it (plan/06-storefront/13-navigation-and-categories.md section 4): built from the category tree and the collections
// (the default, "automatic"), or the menu staff wrote when the Store setting says "custom". A menu address is typed by staff, so each one goes through `safeHref`;
// an item whose address is not safe is left out, with its children.
import { safeHref } from '@noor/ui/safe-href'
import { localePath } from './paths'

/** @typedef {{ id: string, label: string, href: string, children?: NavItem[] }} NavItem */
/** @typedef {{ id: string, handle: string, name: string, children: CategoryTree[] }} CategoryTree */

/**
 * @param {import('@noor/i18n').Locale} locale
 * @param {{ id: string, label: string, href: string, children?: NavItem[] | undefined }[]} items
 * @returns {NavItem[]}
 */
export function safeItems(locale, items) {
  /** @type {NavItem[]} */
  const out = []
  for (const item of items) {
    const href = safeHref(item.href)
    if (href === undefined) continue
    const children = item.children ? safeItems(locale, item.children) : undefined
    out.push({ id: item.id, label: item.label, href: href.startsWith('/') ? localePath(locale, href) : href, ...(children?.length ? { children } : {}) })
  }
  return out
}

/** How many items the header holds before the rest go under "More" (DOC-06.13 section 4.1). */
const MAX_ITEMS = 8

/** The categories as links, three levels deep (the panel of the header shows a category, its children and their children; a deeper level is reached from its parent's page). @param {import('@noor/i18n').Locale} locale @param {CategoryTree[]} nodes @param {number} depth @returns {NavItem[]} */
const categoryItems = (locale, nodes, depth) =>
  nodes.map((c) => ({
    id: c.id,
    label: c.name,
    href: localePath(locale, `/c/${c.handle}`),
    ...(depth < 3 && c.children.length ? { children: categoryItems(locale, c.children, depth + 1) } : {}),
  }))

/**
 * @param {object} o
 * @param {import('@noor/i18n').Locale} o.locale
 * @param {'automatic' | 'custom'} o.mode
 * @param {{ id: string, label: string, href: string, children?: NavItem[] | undefined }[]} o.menu the menu `main` staff wrote
 * @param {CategoryTree[]} o.categories the visible category tree (branches with no product are already left out by the API)
 * @param {{ id: string, handle: string, title: string }[]} o.collections the featured collections
 * @param {{ new: string, sale: string, collections: string, more: string }} o.labels
 * @returns {NavItem[]}
 */
export function navItems({ locale, mode, menu, categories, collections, labels }) {
  if (mode === 'custom') {
    const own = safeItems(locale, menu)
    if (own.length) return own // an empty custom menu falls back to the automatic one rather than leaving the shop without navigation
  }
  // New in and Sale are pages of their own (`/new`, `/sale`); the other featured collections go under one item
  const featured = collections.filter((c) => c.handle !== 'new-in' && c.handle !== 'sale')
  // at most MAX_ITEMS fit across the header: New in, Sale and Collections always stay, the categories that do not fit go under "More"
  const shown = categoryItems(locale, categories, 1)
  const room = MAX_ITEMS - 2 - (featured.length ? 1 : 0)
  const cats = shown.length > room ? [...shown.slice(0, room - 1), { id: 'more', label: labels.more, href: localePath(locale, '/categories'), children: shown.slice(room - 1).map((c) => ({ id: c.id, label: c.label, href: c.href })) }] : shown
  return [
    { id: 'new', label: labels.new, href: localePath(locale, '/new') },
    ...cats,
    ...(featured.length
      ? [{ id: 'collections', label: labels.collections, href: localePath(locale, '/collections'), children: featured.map((c) => ({ id: c.id, label: c.title, href: localePath(locale, `/collections/${c.handle}`) })) }]
      : []),
    { id: 'sale', label: labels.sale, href: localePath(locale, '/sale') },
  ]
}

/** The pages of the footer menu that answer a customer's question ("Help"); every other page goes under "Company". */
const helpPages = new Set(['shipping-returns', 'contact'])
/** @param {NavItem} item */
const pageSlug = (item) => /\/pages\/([^/?#]+)/.exec(item.href)?.[1]

/**
 * The footer's link columns (plan/06-storefront/13-navigation-and-categories.md section 7): Shop and Collections come from the data, Help and Company from the pages
 * staff list in the footer menu.
 * @param {object} o
 * @param {import('@noor/i18n').Locale} o.locale
 * @param {CategoryTree[]} o.categories
 * @param {{ id: string, handle: string, title: string }[]} o.collections
 * @param {NavItem[]} o.pages the footer menu, already made safe
 * @param {{ new: string, sale: string, allCategories: string, allCollections: string, trackOrder: string, sizeGuide: string }} o.labels
 * @returns {{ shop: NavItem[], collections: NavItem[], help: NavItem[], company: NavItem[] }}
 */
export function footerColumns({ locale, categories, collections, pages, labels }) {
  const featured = collections.filter((c) => c.handle !== 'new-in' && c.handle !== 'sale')
  return {
    shop: [
      { id: 'new', label: labels.new, href: localePath(locale, '/new') },
      ...categories.map((c) => ({ id: c.id, label: c.name, href: localePath(locale, `/c/${c.handle}`) })),
      { id: 'sale', label: labels.sale, href: localePath(locale, '/sale') },
      { id: 'all-categories', label: labels.allCategories, href: localePath(locale, '/categories') },
    ],
    collections: featured.length
      ? [...featured.map((c) => ({ id: c.id, label: c.title, href: localePath(locale, `/collections/${c.handle}`) })), { id: 'all-collections', label: labels.allCollections, href: localePath(locale, '/collections') }]
      : [],
    help: [
      { id: 'track', label: labels.trackOrder, href: localePath(locale, '/track') },
      ...pages.filter((p) => helpPages.has(pageSlug(p) ?? '')),
      { id: 'size-guide', label: labels.sizeGuide, href: localePath(locale, '/size-guide') },
    ],
    company: pages.filter((p) => !helpPages.has(pageSlug(p) ?? '')),
  }
}
