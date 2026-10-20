// Every page is a lazy route (ADR-0015). Sign-in screens stand alone; everything else lives inside the shell, whose loader reads the session.
import { ErrorState } from '@noor/ui/error-state'
import { Spinner } from '@noor/ui/spinner'
import { createBrowserRouter, redirect } from 'react-router'
import { RouteError } from '@/components/route-error'
import { screens } from '@/lib/screens'
import { requireMe } from '@/lib/session'

/** @param {{ request: Request; }} args */
async function shellLoader({ request }) {
  const me = await requireMe(request)
  // while two-step set-up is required and not done, the only reachable screens are that set-up and sign-out
  if (me.twoFactorRequired && !me.twoFactorEnabled) throw redirect('/enrol-2fa')
  return null
}

/** @param {{ request: Request; }} args */
async function printLoader({ request }) {
  await requireMe(request)
  return null
}

const Loading = () => (
  <div className="grid min-h-dvh place-items-center">
    <Spinner label="Loading" />
  </div>
)

/** The shell itself failed (the session could not be read): there is no frame to keep. */
function ShellError() {
  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <ErrorState title="The admin could not be loaded" body="Check that the API is running, then try again." retryLabel="Try again" onRetry={() => window.location.reload()} />
    </div>
  )
}

/** Old addresses of the previous admin (plan/07-admin/01 section 7). */
const moved = /** @type {const} */ ([
  ['/pages', '/content/pages'],
  ['/menus', '/content/menus'],
  ['/site', '/content/home'],
  ['/settings', '/settings/store'],
  ['/appearance', '/settings/appearance'],
  ['/shipping', '/settings/shipping'],
  ['/templates', '/'],
  ['/data', '/'],
])

export const routes = [
  { path: '/login', lazy: () => import('@/routes/login'), HydrateFallback: Loading },
  { path: '/login/2fa', lazy: () => import('@/routes/login-2fa'), HydrateFallback: Loading },
  { path: '/forgot-password', lazy: () => import('@/routes/forgot-password'), HydrateFallback: Loading },
  { path: '/reset-password/:token', lazy: () => import('@/routes/reset-password'), HydrateFallback: Loading },
  { path: '/accept-invite/:token', lazy: () => import('@/routes/accept-invite'), HydrateFallback: Loading },
  { path: '/enrol-2fa', lazy: () => import('@/routes/enrol-2fa'), HydrateFallback: Loading },
  ...moved.map(([from, to]) => ({ path: from, loader: () => redirect(to) })),
  // the invoice pages have no shell: they are for the printer (plan/07-admin/05-orders.md section 5.2)
  ...['/orders/print', '/orders/:id/print'].map((path) => ({ path, loader: printLoader, lazy: () => import('@/routes/order-print'), HydrateFallback: Loading })),
  ...[['/delivery/receipts/:id/print', 'delivery-receipt-print'], ['/delivery/runs/:id/print', 'delivery-run-print']].map(([path, file]) => ({ path, loader: printLoader, lazy: () => import(`../routes/${file}.jsx`), HydrateFallback: Loading })),
  {
    path: '/',
    loader: shellLoader,
    lazy: () => import('@/components/app-shell'),
    ErrorBoundary: ShellError,
    HydrateFallback: Loading,
    children: [
      {
        ErrorBoundary: RouteError,
        children: [
          ...screens.map((s) => ({
            ...(s.path === '/' ? { index: true } : { path: s.path.slice(1) }),
            handle: { title: s.title, permission: s.permission, group: s.group },
            lazy: s.lazy,
          })),
          { path: '*', lazy: () => import('@/routes/not-found'), handle: { title: 'Not found' } },
        ],
      },
    ],
  },
]

export const createRouter = () => createBrowserRouter(routes)
