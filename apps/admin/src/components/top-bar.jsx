import { Breadcrumb } from '@noor/ui/breadcrumb'
import { IconButton } from '@noor/ui/button'
import { Menu } from '@noor/ui/menu'
import { LogOut, Menu as MenuIcon, Monitor, Moon, Store, Sun, User } from 'lucide-react'
import { useMatches, useNavigate } from 'react-router'
import { env } from '@/lib/env'
import { setPrefs, usePrefs } from '@/lib/prefs'
import { useLogout, useMe } from '@/lib/session'

const themeIcons = /** @type {const} */ ({ light: Sun, dark: Moon, system: Monitor })

/** The section and screen the person is on, from the route handles. */
function Crumbs() {
  const handles = useMatches().flatMap((m) => (m.handle ? [/** @type {{ title?: string; group?: string; }} */ (m.handle)] : []))
  const current = handles.at(-1)
  if (!current?.title) return null
  const items = [...(current.group ? [{ label: current.group }] : []), { label: current.title }]
  return <Breadcrumb items={items} />
}

/**
 * Menu button (below `lg`), breadcrumb, theme and user menus. The command palette (`Ctrl/Cmd K`) arrives with DOC-07.15.
 * @param {{ onOpenMenu: () => void; }} props
 */
export function TopBar({ onOpenMenu }) {
  const me = useMe()
  const navigate = useNavigate()
  const logout = useLogout()
  const { theme } = usePrefs()
  const ThemeIcon = themeIcons[theme]
  return (
    <div className="flex h-14 items-center gap-2 border-b border-line bg-surface px-4">
      <span className="lg:hidden">
        <IconButton label="Open menu" icon={<MenuIcon aria-hidden className="size-5" />} onClick={onOpenMenu} />
      </span>
      <div className="min-w-0 flex-1">
        <Crumbs />
      </div>
      <Menu
        align="end"
        trigger={<IconButton label={`Theme: ${theme}`} icon={<ThemeIcon aria-hidden className="size-5" />} />}
        items={[
          { label: 'Light', icon: <Sun aria-hidden className="size-4" />, onSelect: () => setPrefs({ theme: 'light' }) },
          { label: 'Dark', icon: <Moon aria-hidden className="size-4" />, onSelect: () => setPrefs({ theme: 'dark' }) },
          { label: 'System', icon: <Monitor aria-hidden className="size-4" />, onSelect: () => setPrefs({ theme: 'system' }) },
        ]}
      />
      <Menu
        align="end"
        trigger={
          <IconButton
            label={`${me.name}, ${me.role}`}
            icon={
              <span aria-hidden className="grid size-8 place-items-center rounded-full bg-accent-soft text-sm font-medium text-accent-text">
                {me.name.slice(0, 1).toUpperCase()}
              </span>
            }
          />
        }
        items={[
          { label: 'My account', icon: <User aria-hidden className="size-4" />, onSelect: () => void navigate('/account') },
          { label: 'View storefront', icon: <Store aria-hidden className="size-4" />, onSelect: () => window.open(env.storefrontUrl, '_blank', 'noopener') },
          { label: 'Sign out', icon: <LogOut aria-hidden className="size-4" />, onSelect: () => logout.mutate() },
        ]}
      />
    </div>
  )
}
