import { IconButton } from '@noor/ui/button'
import { Drawer } from '@noor/ui/drawer'
import { ErrorState } from '@noor/ui/error-state'
import { ToastProvider, useToast } from '@noor/ui/toast'
import { useQueryClient } from '@tanstack/react-query'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet, useMatches } from 'react-router'
import { sessionEvents } from '@/lib/events'
import { setPrefs, usePrefs } from '@/lib/prefs'
import { meKey, useCan, useMe } from '@/lib/session'
import { SidebarNav } from './sidebar'
import { TopBar } from './top-bar'

/** @typedef {{ title?: string; permission?: import('@noor/contract').Permission; }} Handle */

/** The frame of every signed-in screen: sidebar, top bar, environment banner and the screen itself (plan/07-admin/01 sections 3 and 4). */
function Shell() {
  const me = useMe()
  const can = useCan()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { sidebarCollapsed } = usePrefs()
  const [drawer, setDrawer] = useState(false)
  const handles = useMatches().flatMap((m) => (m.handle ? [/** @type {Handle} */ (m.handle)] : []))
  const required = handles.findLast((h) => h.permission)?.permission
  const title = handles.at(-1)?.title

  // a 403 from a screen that was still showing something the role no longer allows: say so and re-read the permissions
  useEffect(() => {
    const onForbidden = () => {
      toast.push({ title: 'You no longer have permission', tone: 'warning' })
      void queryClient.invalidateQueries({ queryKey: meKey })
    }
    sessionEvents.addEventListener('forbidden', onForbidden)
    return () => sessionEvents.removeEventListener('forbidden', onForbidden)
  }, [toast, queryClient])

  return (
    <div className="flex min-h-dvh bg-bg text-fg">
      <title>{title ? `${title} · Rubaya admin` : 'Rubaya admin'}</title>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className={`sticky top-0 hidden h-dvh shrink-0 flex-col bg-sidebar text-sidebar-fg lg:flex ${sidebarCollapsed ? 'w-16' : 'w-60'}`}>
        <div className={`flex h-14 items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between ps-5 pe-2'}`}>
          {sidebarCollapsed ? null : <span className="font-heading text-lg font-semibold tracking-wide">RUBAYA</span>}
          <IconButton
            label={sidebarCollapsed ? 'Expand the menu' : 'Collapse the menu'}
            icon={sidebarCollapsed ? <PanelLeftOpen aria-hidden className="size-5" /> : <PanelLeftClose aria-hidden className="size-5" />}
            onClick={() => setPrefs({ sidebarCollapsed: !sidebarCollapsed })}
            className="text-sidebar-fg hover:bg-sidebar-active"
          />
        </div>
        <SidebarNav collapsed={sidebarCollapsed} />
      </aside>
      <Drawer open={drawer} onOpenChange={setDrawer} side="start" title="Menu">
        <div className="-mx-4 -my-4 bg-sidebar text-sidebar-fg">
          <SidebarNav onNavigate={() => setDrawer(false)} />
        </div>
      </Drawer>
      <div className="flex min-w-0 flex-1 flex-col">
        {me.environment === 'production' ? null : (
          <p role="status" className="bg-warning-soft px-4 py-1 text-center text-sm text-warning">
            {me.environment === 'staging' ? 'Staging' : 'Local'}: test data
          </p>
        )}
        <TopBar onOpenMenu={() => setDrawer(true)} />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none lg:p-6">
          {required && !can(required) ? <ErrorState title="You don't have access to this page" body="Ask an owner or manager." /> : <Outlet />}
        </main>
      </div>
    </div>
  )
}

/** Loaded lazily by the router, so the sign-in screens do not carry the shell, its menus and toasts. */
export function Component() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  )
}
