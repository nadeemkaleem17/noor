// Test helpers: the whole router with a fake API behind `fetch`.
import { createStaffI18n } from '@noor/i18n/staff'
import { DirectionProvider } from '@noor/ui/direction'
import { ToastProvider } from '@noor/ui/toast'
import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { routes } from '@/app/router'
import { setCsrfToken } from '@/lib/api'
import { queryClient } from '@/lib/query-client'

export const ids = { staff: '0194f1b2-7c3a-7000-8000-000000000001' }

/** @param {Partial<import('@noor/contract').Me>} [over] */
export const me = (over = {}) => ({
  id: ids.staff,
  name: 'Ayesha Khan',
  email: 'ayesha@example.com',
  role: /** @type {const} */ ('owner'),
  permissions: /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'products:read', 'products:write', 'orders:read', 'settings:read', 'staff:read', 'audit:read']),
  twoFactorEnabled: true,
  twoFactorRequired: true,
  csrfToken: 'csrf-token-1',
  environment: /** @type {const} */ ('local'),
  ...over,
})

/** @param {number} status @param {unknown} [body] */
export const json = (status, body) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: body === undefined ? {} : { 'content-type': 'application/json' } })

/** @param {string} code @param {number} status @param {Record<string, unknown>} [extra] */
export const problem = (status, code, extra = {}) => json(status, { title: code, status, code, ...extra })

/**
 * Replaces `fetch` with a table of `"METHOD /path"` answers (paths relative to /api/v1). Anything not in the table fails the test.
 * @param {Record<string, (request: { body: any; headers: Headers; url: URL; }) => Response>} table
 */
export function fakeApi(table) {
  // the catalog lookups every product screen reads; a test overrides the ones it cares about
  table = { "GET /admin/customers/highlight-rules": () => json(200, { items: [] }), "GET /admin/customers/visit-summary": () => json(200, { visits: 0, visitors: 0, newVisitors: 0, returningVisitors: 0, identifiedVisitors: 0, days: [] }), "GET /admin/search-index": () => json(200, { active: 3, indexed: 3, missing: 0, stale: 0, orphaned: 0, rebuildQueued: false }), "GET /admin/background": () => json(200, { state: "ok", workers: 1, waiting: 0, overdue: 0, oldestOverdueSeconds: 0, dead: 0, waitingTypes: [] }), "GET /admin/nav/counts": () => json(200, {}), "GET /admin/attributes": () => json(200, { items: [] }), "GET /admin/size-systems": () => json(200, { items: [] }), "GET /admin/size-charts": () => json(200, { items: [] }), "GET /admin/form-schemas": () => json(200, { items: [] }), ...table }
  /** @type {string[]} */
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (/** @type {string | URL | Request} */ input, /** @type {RequestInit | undefined} */ init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      const key = `${init?.method ?? 'GET'} ${url.pathname.replace('/api/v1', '')}`
      calls.push(key)
      const handler = table[key]
      if (!handler) throw new Error(`unexpected API call: ${key}`)
      return handler({ body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined, headers: new Headers(init?.headers), url })
    }),
  )
  // a picture goes to storage by XMLHttpRequest (that is how progress is known); here the same table answers it, as it would a fetch
  vi.stubGlobal(
    'XMLHttpRequest',
    class {
      upload = {}
      status = 0
      method = 'GET'
      url = ''
      /** @type {(() => void) | null} */ onload = null
      /** @type {(() => void) | null} */ onerror = null
      /** @type {(() => void) | null} */ onabort = null
      /** @param {string} method @param {string} url */
      open(method, url) {
        this.method = method
        this.url = url
      }
      setRequestHeader() {}
      abort() {
        this.onabort?.()
      }
      /** @param {unknown} body */
      send(body) {
        globalThis.fetch(this.url, { method: this.method, body: /** @type {never} */ (body) }).then(
          (r) => {
            this.status = r.status
            this.onload?.()
          },
          () => this.onerror?.(),
        )
      }
    },
  )
  return calls
}

export function resetApp() {
  vi.unstubAllGlobals()
  queryClient.clear()
  setCsrfToken('')
  localStorage.clear()
}

/** @param {string} path */
export function renderApp(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createStaffI18n()}>
        <DirectionProvider direction="ltr">
          <RouterProvider router={router} />
        </DirectionProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  )
  return { router, user }
}

/**
 * Mounts a component inside the providers and a memory router, with the session answered by a fake API (for `useCan`).
 * @param {import('react').ReactNode} element
 * @param {{ path?: string; permissions?: import('@noor/contract').Permission[]; }} [options]
 */
export function renderWithApp(element, { path = '/', permissions = ['products:read'] } = {}) {
  fakeApi({ 'GET /admin/me': () => json(200, me({ permissions })) })
  const router = createMemoryRouter([{ path: '*', element: <ToastProvider><Suspense fallback={null}>{element}</Suspense></ToastProvider> }], { initialEntries: [path] })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createStaffI18n()}>
        <DirectionProvider direction="ltr">
          <RouterProvider router={router} />
        </DirectionProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  )
  return { router, user }
}

const now = '2026-10-05T10:00:00.000Z'
export const ids2 = { product: '0194f1b2-7c3a-7000-8000-0000000000a1', cat: '0194f1b2-7c3a-7000-8000-0000000000c1', cat2: '0194f1b2-7c3a-7000-8000-0000000000c2' }

/** @param {Record<string, unknown>} [over] */
export const productFixture = (over = {}) => ({
  id: ids2.product,
  handle: 'cotton-kurta',
  status: 'draft',
  kind: 'stitched',
  title: 'Cotton Kurta',
  primaryCategoryId: ids2.cat,
  categoryIds: [],
  attributes: [],
  media: [],
  options: [],
  variants: [],
  badges: [],
  version: 3,
  createdAt: now,
  updatedAt: now,
  siblings: [],
  collections: [],
  checks: [],
  ...over,
})

export const categoriesAnswer = () =>
  json(200, {
    items: [
      { id: ids2.cat, name: 'Women', handle: 'women', parentId: null, visible: true, attributes: [], sortOrder: 0, productCount: 2, version: 1, shop: { shown: true, liveProducts: 1 } },
      { id: ids2.cat2, name: 'Stitched', handle: 'stitched', parentId: ids2.cat, visible: true, attributes: [], sortOrder: 0, productCount: 1, version: 1, shop: { shown: true, liveProducts: 1 } },
    ],
  })
