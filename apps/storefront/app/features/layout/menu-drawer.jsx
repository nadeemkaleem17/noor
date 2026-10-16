import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { Drawer } from '@noor/ui/drawer'
import { NavLink } from './nav-link'
import { useLocalePath, useShell } from './use-shell'

/** @typedef {import('~/lib/nav').NavItem} NavItem */

const row = 'flex w-full items-center justify-between px-4 py-3 text-start text-fg hover:bg-surface-2'

/**
 * The phone menu (DOC-06.13 section 4.4): a drawer from the start edge that drills down. A search field, then the items; one with children opens the next level, whose first row is
 * "All <name>" so its own page stays reachable, and a back button is always at the top of a deeper level. Track order and WhatsApp are at the foot of the first level.
 * A file of its own: nobody downloads it until the menu button is pressed.
 * @param {{ items: NavItem[], open: boolean, onOpenChange: (open: boolean) => void }} props
 */
export default function MenuDrawer({ items, open, onOpenChange }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const whatsapp = useShell()?.config.contact.whatsapp
  const [trail, setTrail] = useState(/** @type {NavItem[]} */ ([]))
  const nav = useRef(/** @type {HTMLElement | null} */ (null))
  const close = () => onOpenChange(false)
  const here = trail.at(-1)
  const list = here?.children ?? items
  /** Move one level and bring the keyboard along: the row that was pressed is gone. @param {NavItem[]} next */
  const go = (next) => {
    setTrail(next)
    nav.current?.focus()
  }
  return (
    <Drawer
      side="start"
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setTrail([])
      }}
      title={t('shell.menu')}
      closeLabel={t('shell.menuClose')}
    >
      <form role="search" method="get" action={path('/search')} className="px-4 pb-3">
        <label className="sr-only" htmlFor="menu-search">
          {t('shell.menuSearch')}
        </label>
        <input id="menu-search" name="q" type="search" required minLength={2} maxLength={80} placeholder={t('shell.searchPlaceholder')} className="h-(--control-h) w-full rounded-control border border-line-strong bg-bg px-3" />
      </form>
      <nav ref={nav} tabIndex={-1} aria-label={t('shell.navLabel')} className="outline-none">
        {here ? (
          <button type="button" className={`${row} justify-start gap-2 border-y border-line font-medium`} onClick={() => go(trail.slice(0, -1))}>
            <ChevronLeft aria-hidden="true" className="size-5 rtl:rotate-180" />
            {t('shell.backTo', { name: trail.at(-2)?.label ?? t('shell.menu') })}
          </button>
        ) : null}
        <ul className="flex flex-col">
          {here ? (
            <li>
              <NavLink item={{ id: `${here.id}-all`, label: t('shell.allIn', { name: here.label }), href: here.href }} onClick={close} className={`${row} font-medium`} />
            </li>
          ) : null}
          {list.map((item) => (
            <li key={item.id}>
              {item.children?.length && trail.length < 2 ? (
                <button type="button" className={`${row} font-medium`} onClick={() => go([...trail, item])}>
                  {item.label}
                  <ChevronRight aria-hidden="true" className="size-5 text-muted rtl:rotate-180" />
                </button>
              ) : (
                <NavLink item={item} onClick={close} className={`${row} ${here ? 'text-fg-soft' : 'font-medium'} ${item.id === 'sale' ? 'text-sale!' : ''}`} />
              )}
            </li>
          ))}
        </ul>
      </nav>
      {here ? null : (
        <ul className="mt-2 flex flex-col border-t border-line pt-2 text-small">
          <li>
            <RouterLink to={path('/track')} onClick={close} className={`${row} text-fg-soft`}>
              {t('shell.trackOrder')}
            </RouterLink>
          </li>
          {whatsapp ? (
            <li>
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className={`${row} text-fg-soft`}>
                {t('shell.whatsapp')}
              </a>
            </li>
          ) : null}
        </ul>
      )}
    </Drawer>
  )
}
