import { ChevronDown, Menu as MenuIcon, Search } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { CartLink } from '../cart/cart-link'
import { WishlistLink } from '../wishlist/wishlist-link'
import { NavLink } from './nav-link'
import { useLocalePath } from './use-shell'

/** @typedef {import('~/lib/nav').NavItem} NavItem */

const MenuDrawer = lazy(() => import('./menu-drawer'))
const SearchPanel = lazy(() => import('./search-panel'))

const iconButton = 'grid size-11 place-items-center rounded-control text-fg hover:bg-surface-2'
const linkClass = 'rounded-control px-3 py-2 text-fg hover:bg-surface-2'
/** Links under a column heading in a panel (DOC-06.13 section 4.2): the rest are one click away on the heading's page. */
const PANEL_LINKS = 5

/** The menu button on a phone. The drawer it opens is downloaded the first time the button is pressed. @param {{ items: NavItem[] }} props */
function MobileMenu({ items }) {
  const { t } = useTranslation('storefront')
  const [open, setOpen] = useState(false)
  const [opened, setOpened] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={t('shell.menu')}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`${iconButton} lg:hidden`}
        onClick={() => {
          setOpen(true)
          setOpened(true)
        }}
      >
        <MenuIcon aria-hidden="true" className="size-6" />
      </button>
      {opened ? (
        <Suspense fallback={null}>
          <MenuDrawer items={items} open={open} onOpenChange={setOpen} />
        </Suspense>
      ) : null}
    </>
  )
}

/** What a top item opens: a column for each child with its own links under it when the children have children, otherwise one list; always a link to the whole of it. @param {{ item: NavItem, onNavigate: () => void }} props */
function Panel({ item, onNavigate }) {
  const { t } = useTranslation('storefront')
  const children = item.children ?? []
  const columns = children.some((c) => c.children?.length)
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {columns ? (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-x-8 gap-y-6">
          {children.map((col) => (
            <li key={col.id}>
              <NavLink item={col} onClick={onNavigate} className="block py-1 font-medium text-fg hover:underline" />
              {col.children?.length ? (
                <ul className="mt-1 flex flex-col">
                  {col.children.slice(0, PANEL_LINKS).map((c) => (
                    <li key={c.id}>
                      <NavLink item={c} onClick={onNavigate} className="block py-1 text-small text-fg-soft hover:text-fg hover:underline" />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-x-8 sm:grid-cols-3">
          {children.map((c) => (
            <li key={c.id}>
              <NavLink item={c} onClick={onNavigate} className="block py-1.5 text-fg-soft hover:text-fg hover:underline" />
            </li>
          ))}
        </ul>
      )}
      <NavLink item={{ id: `${item.id}-all`, label: t('shell.viewAll', { name: item.label }), href: item.href }} onClick={onNavigate} className="mt-4 inline-block text-small font-medium text-fg underline underline-offset-4" />
    </div>
  )
}

/**
 * The menu on a wide screen (DOC-06.13 section 4.2). Every item is a link; one with children also has a button that opens its panel, and the pointer opens it too (after 150 ms,
 * and it closes 200 ms after the pointer leaves). Escape closes the panel and returns to the button; leaving it with the keyboard, pressing outside it or following a link closes it.
 * The panels are in the page's HTML, so the links are there without JavaScript, where the pointer still opens them.
 * @param {{ items: NavItem[] }} props
 */
function DesktopNav({ items }) {
  const { t } = useTranslation('storefront')
  const [open, setOpen] = useState(/** @type {string | null} */ (null))
  // after a link or Escape the panel stays shut until the pointer has left the item (it is still over it, and would reopen the panel at once)
  const [hushed, setHushed] = useState(/** @type {string | null} */ (null))
  useEffect(() => {
    if (!open) return
    /** @param {PointerEvent} e */
    const away = (e) => {
      if (!(e.target instanceof Element) || !e.target.closest('[data-nav-item]')) setOpen(null)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])
  return (
    <nav aria-label={t('shell.navLabel')} className="hidden lg:flex lg:justify-center">
      <ul className="flex items-center gap-1">
        {items.map((item) => (
          <li
            key={item.id}
            data-nav-item
            data-hushed={hushed === item.id ? '' : undefined}
            className="group/item flex items-center"
            onMouseLeave={() => setHushed(null)}
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return
              setOpen(null)
              setHushed(item.id)
              e.currentTarget.querySelector('button')?.focus()
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setOpen((o) => (o === item.id ? null : o))
            }}
          >
            <NavLink item={item} className={`${linkClass} font-medium ${item.id === 'sale' ? 'text-sale' : ''}`} />
            {item.children ? (
              <>
                <button
                  type="button"
                  aria-label={t('shell.showLinks', { name: item.label })}
                  aria-expanded={open === item.id}
                  aria-controls={`panel-${item.id}`}
                  className="-ms-2 grid size-8 place-items-center rounded-control hover:bg-surface-2"
                  onClick={() => {
                    setHushed(null)
                    setOpen(open === item.id ? null : item.id)
                  }}
                >
                  <ChevronDown aria-hidden="true" className="size-4" />
                </button>
                {/* shown by the pointer (CSS) or by the button (state); the 100 ms fade has a delay of 150 ms in and 200 ms out, and none at all for the button */}
                <div
                  id={`panel-${item.id}`}
                  data-open={open === item.id ? '' : undefined}
                  className="invisible absolute inset-x-0 top-full border-t border-b border-line bg-surface opacity-0 transition-[opacity,visibility] duration-(--dur-fast) delay-200 group-hover/item:visible group-hover/item:opacity-100 group-hover/item:delay-150 data-open:visible data-open:opacity-100 data-open:delay-0 group-data-hushed/item:invisible! group-data-hushed/item:opacity-0!"
                >
                  <Panel
                    item={item}
                    onNavigate={() => {
                      setOpen(null)
                      setHushed(item.id)
                    }}
                  />
                </div>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** True while the visitor scrolls down past the header and false as soon as they scroll up (DOC-06.14 SH-05); never true when `enabled` is false. @param {boolean} enabled */
function useScrolledAway(enabled) {
  const [away, setAway] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (Math.abs(y - last) < 8) return
      setAway(y > last && y > 160)
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [enabled])
  return enabled && away
}

/**
 * The top of every page (plan/06-storefront/01-sitemap.md section 3): the menu, the logo, search, the wishlist and the cart.
 * Search is a real link to `/search` that, with JavaScript, opens the search field under the header; the cart is a real link to `/cart`.
 * `bar` is the Appearance setting: the logo on the left or in the middle (the menu then on a row of its own), and whether the header stays at the top.
 * @param {{ brand: string, logo?: import('@noor/contract').Image | undefined, items: NavItem[], wishlist: boolean, bar?: { layout: 'left' | 'center', sticky: boolean } }} props
 */
export function Header({ brand, logo, items, wishlist, bar = { layout: 'left', sticky: true } }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const [searching, setSearching] = useState(false)
  const searchButton = useRef(/** @type {HTMLAnchorElement | null} */ (null))
  const away = useScrolledAway(bar.sticky)
  const centre = bar.layout === 'center'

  return (
    <header
      data-away={away ? '' : undefined}
      className={`${bar.sticky ? 'sticky top-0' : 'relative'} z-header border-b border-line bg-bg transition-transform duration-(--dur-base) ease-standard data-away:-translate-y-full data-away:focus-within:translate-y-0 data-away:hover:translate-y-0`}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2">
        <MobileMenu items={items} />
        <RouterLink to={path('/')} className={`me-1 flex items-center font-heading text-2xl font-semibold text-fg sm:me-4 ${centre ? 'mx-auto' : ''}`}>
          {logo ? <img src={logo.src} srcSet={logo.srcset} alt={brand} width={logo.width} height={logo.height} className="h-9 w-auto" /> : brand}
        </RouterLink>
        <div className={centre ? 'order-last hidden basis-full lg:block' : 'contents'}>
          <DesktopNav items={items} />
        </div>
        <div className={`${centre ? '' : 'ms-auto'} flex items-center`}>
          <RouterLink to={path('/track')} className="hidden px-3 text-small text-fg-soft hover:text-fg hover:underline lg:block">
            {t('shell.trackOrder')}
          </RouterLink>
          <RouterLink
            ref={searchButton}
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
        <Suspense fallback={null}>
          <SearchPanel
            onClose={() => {
              setSearching(false)
              searchButton.current?.focus()
            }}
          />
        </Suspense>
      ) : null}
    </header>
  )
}
