import { useTranslation } from 'react-i18next'
import { Accordion } from '@noor/ui/accordion'
import { Drawer } from '@noor/ui/drawer'
import { NavLink } from './nav-link'

/** @typedef {import('~/lib/nav').NavItem} NavItem */

/** The phone menu's drawer, from the start edge, with a group for each item that has children. A file of its own: nobody downloads it until the menu button is pressed. @param {{ items: NavItem[], open: boolean, onOpenChange: (open: boolean) => void }} props */
export default function MenuDrawer({ items, open, onOpenChange }) {
  const { t } = useTranslation('storefront')
  const close = () => onOpenChange(false)
  return (
    <Drawer side="start" open={open} onOpenChange={onOpenChange} title={t('shell.menu')} closeLabel={t('shell.menuClose')}>
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
