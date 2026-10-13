import { Link as RouterLink } from 'react-router'
import { Link } from '@noor/ui/link'

/** @typedef {import('~/lib/nav').NavItem} NavItem */

/** A menu item's link: an address inside the shop goes through the router, any other is an ordinary link. @param {{ item: NavItem, onClick?: () => void, className?: string }} props */
export function NavLink({ item, onClick, className }) {
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
