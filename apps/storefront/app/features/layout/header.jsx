import { ChevronDown, Menu as MenuIcon, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { Accordion } from '@noor/ui/accordion'
import { Drawer } from '@noor/ui/drawer'
import { Link } from '@noor/ui/link'
import { Popover } from '@noor/ui/popover'
import { CartLink } from '../cart/cart-link'
import { WishlistLink } from '../wishlist/wishlist-link'
import { useLocalePath } from './use-shell'

/** @typedef {import('~/lib/nav').NavItem} NavItem */

const iconButton = 'grid size-11 place-items-center rounded-control text-fg hover:bg-surface-2'
const linkClass = 'rounded-control px-3 py-2 text-fg hover:bg-surface-2'

/** A menu item's link: an address inside the shop goes through the router, any other is an ordinary link. @param {{ item: NavItem, onClick?: () => void, className?: string }} props */
function NavLink({ item, onClick, className }) {
  const inside = item.href.startsWith('/')
  return inside ? (
    <RouterLink to={item.href} prefetch="intent" onClick={onClick} className={className}>
      {item.label}
    </RouterLink>
  ) : (
    <Link href={item.href} onClick={onClick} className={className}>
      {item.label}
    </Link>
  )
}

/** The menu on a phone: a drawer from the start edge, with a group for each item that has children. @param {{ items: NavItem[] }} props */
function MobileMenu({ items }) {
  const { t } = useTranslation('storefront')
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <Drawer
      side="start"
      open={open}
      onOpenChange={setOpen}
      title={t('shell.menu')}
      closeLabel={t('shell.menuClose')}
      trigger={
        <button type="button" aria-label={t('shell.menu')} className={`${iconButton} lg:hidden`}>
          <MenuIcon aria-hidden="true" className="size-6" />
        </button>
      }
    >
      <nav aria-label={t('shell.navLabel')}>
        <ul className="flex flex-col">
          {items.map((item) =>
            item.children ? (
              <li key={item.id}>
                <Accordion items={[{ id: item.id, title: item.label, content: <ul className="flex flex-col pb-2">{[{ ...item, label: item.label }, ...item.children].map((c, i) => <li key={`${c.id}-${i}`}><NavLink item={c} onClick={close} className="block px-3 py-2 text-fg-soft" /></li>)}</ul> }]} />
              </li>
            ) : (
              <li key={item.id}>
                <NavLink item={item} onClick={close} className="block px-3 py-3 font-medium" />
              </li>
            ),
          )}
        </ul>
      </nav>
    </Drawer>
  )
}

/** The menu on a wide screen: links across the header; one with children opens a panel on click (never on hover, so a keyboard or a finger can use it). @param {{ items: NavItem[] }} props */
function DesktopNav({ items }) {
  const { t } = useTranslation('storefront')
  return (
    <nav aria-label={t('shell.navLabel')} className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center">
            {/* every item is a real link, so the menu works without JavaScript; one with children also has a button that opens them */}
            <NavLink item={item} className={`${linkClass} font-medium`} />
            {item.children ? (
              <Popover
                label={item.label}
                trigger={
                  <button type="button" aria-label={t('shell.showLinks', { name: item.label })} className="grid size-8 place-items-center rounded-control hover:bg-surface-2">
                    <ChevronDown aria-hidden="true" className="size-4" />
                  </button>
                }
              >
                <ul className="flex min-w-44 flex-col">
                  {item.children.map((c) => (
                    <li key={c.id}>
                      <NavLink item={c} className="block rounded-control px-3 py-2 hover:bg-surface-2" />
                    </li>
                  ))}
                </ul>
              </Popover>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * The top of every page (plan/06-storefront/01-sitemap.md section 3): the menu, the logo, search, the wishlist and the cart.
 * Search is a real link to `/search` that, with JavaScript, opens the search field under the header; the cart is a real link to `/cart`.
 * @param {{ brand: string, logo?: import('@noor/contract').Image | undefined, items: NavItem[], wishlist: boolean }} props
 */
export function Header({ brand, logo, items, wishlist }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const [searching, setSearching] = useState(false)

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2">
        <MobileMenu items={items} />
        <RouterLink to={path('/')} className="me-1 flex items-center sm:me-4 font-heading text-2xl font-semibold text-fg">
          {logo ? <img src={logo.src} srcSet={logo.srcset} alt={brand} width={logo.width} height={logo.height} className="h-9 w-auto" /> : brand}
        </RouterLink>
        <DesktopNav items={items} />
        <div className="ms-auto flex items-center">
          <RouterLink
            to={path('/search')}
            aria-label={t('shell.search')}
            aria-expanded={searching}
            className={iconButton}
            onClick={(e) => {
              e.preventDefault()
              setSearching((s) => !s)
            }}
          >
            <Search aria-hidden="true" className="size-6" />
          </RouterLink>
          {wishlist ? <WishlistLink className={iconButton} /> : null}
          <CartLink className={iconButton} />
        </div>
      </div>
      {searching ? (
        <form role="search" method="get" action={path('/search')} className="border-t border-line bg-surface">
          <div className="mx-auto flex max-w-7xl gap-2 px-4 py-3">
            <label className="sr-only" htmlFor="shop-search">
              {t('shell.searchLabel')}
            </label>
            <input id="shop-search" name="q" type="search" required minLength={2} maxLength={80} autoFocus placeholder={t('shell.searchPlaceholder')} className="h-(--control-h) flex-1 rounded-control border border-line-strong bg-bg px-3" />
            <button type="submit" className="h-(--control-h) rounded-control bg-accent px-5 font-medium text-on-accent">
              {t('shell.searchSubmit')}
            </button>
          </div>
        </form>
      ) : null}
    </header>
  )
}
