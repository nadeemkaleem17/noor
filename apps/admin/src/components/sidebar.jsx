import { cn } from '@noor/ui/cn'
import { Tooltip } from '@noor/ui/tooltip'
import { NavLink } from 'react-router'
import { groups, screens } from '@/lib/screens'
import { useNavCounts } from '@/lib/nav-counts'
import { useCan } from '@/lib/session'

/**
 * The main navigation: only what the signed-in user may open, in groups (plan/07-admin/01 section 3).
 * Badges (orders to handle, reviews to moderate) come with `admin.nav.counts` in M4.
 * @param {{ collapsed?: boolean; onNavigate?: () => void; }} props
 */
export function SidebarNav({ collapsed = false, onNavigate }) {
  const can = useCan()
  const counts = useNavCounts()
  // a feature that is off has no menu item: the server does not give its count then
  const shown = (/** @type {import('@/lib/screens').Screen} */ s) => s.feature !== 'reviews' || counts?.reviewsPending !== undefined
  const visible = groups
    .map((group) => ({ group, items: screens.filter((s) => s.group === group && shown(s) && (!s.permission || can(s.permission))) }))
    .filter((g) => g.items.length > 0)
  return (
    <nav aria-label="Main" className="space-y-4 overflow-y-auto px-2 py-3">
      {visible.map(({ group, items }) => (
        <div key={group}>
          <h2 className={cn('px-3 pb-1 text-xs font-medium uppercase tracking-wide text-sidebar-muted', collapsed && 'sr-only')}>{group}</h2>
          <ul className="space-y-0.5">
            {items.map((item) => {
              const Icon = item.icon
              const link = (
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex h-10 items-center gap-3 rounded-control px-3 text-sm text-sidebar-fg hover:bg-sidebar-active',
                      isActive && 'bg-sidebar-active font-medium',
                      collapsed && 'justify-center px-0',
                    )
                  }
                >
                  {Icon ? <Icon aria-hidden className="size-5 shrink-0" /> : null}
                  <span className={cn(collapsed && 'sr-only')}>{item.title}</span>
                  {item.badge && counts?.[item.badge] ? (
                    <span className={cn('ms-auto rounded-full bg-accent px-2 text-xs font-medium text-on-accent', collapsed && 'sr-only')}>{counts[item.badge]}<span className="sr-only"> waiting</span></span>
                  ) : null}
                </NavLink>
              )
              return (
                <li key={item.path}>
                  {collapsed ? (
                    <Tooltip content={item.title} side="inline-end">
                      {link}
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
