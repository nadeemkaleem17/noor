// The main navigation as the header shows it (plan/06-storefront/01-sitemap.md section 3): the menu the shop set up, or, when there is none, New, the top categories and Sale.
// A menu address is typed by staff, so each one goes through `safeHref`; an item whose address is not safe is left out, with its children.
import { safeHref } from '@noor/ui/safe-href'
import { localePath } from './paths'

/** @typedef {{ id: string, label: string, href: string, children?: NavItem[] }} NavItem */

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

/**
 * @param {object} o
 * @param {import('@noor/i18n').Locale} o.locale
 * @param {{ id: string, label: string, href: string, children?: NavItem[] | undefined }[]} o.menu
 * @param {{ id: string, handle: string, name: string }[]} o.categories the top level of the category tree
 * @param {{ new: string, sale: string }} o.labels
 * @returns {NavItem[]}
 */
export function navItems({ locale, menu, categories, labels }) {
  const own = safeItems(locale, menu)
  if (own.length) return own
  return [
    { id: 'new', label: labels.new, href: localePath(locale, '/new') },
    ...categories.map((c) => ({ id: c.id, label: c.name, href: localePath(locale, `/c/${c.handle}`) })),
    { id: 'sale', label: labels.sale, href: localePath(locale, '/sale') },
  ]
}
