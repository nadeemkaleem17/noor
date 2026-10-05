// Test helpers: the whole router with a fake API behind `fetch`.
import { createStaffI18n } from '@noor/i18n/staff'
import { DirectionProvider } from '@noor/ui/direction'
import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
 * @param {Record<string, (request: { body: any; headers: Headers; }) => Response>} table
 */
export function fakeApi(table) {
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
      return handler({ body: init?.body ? JSON.parse(String(init.body)) : undefined, headers: new Headers(init?.headers) })
    }),
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
