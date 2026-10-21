import { data, redirect, useActionData, useLoaderData } from 'react-router'
import { api } from '~/lib/api.server'
import { AccountPage } from '~/features/account/account-page'
import { privateMeta } from '~/features/seo/meta'
import { accountAction, clearSessionCookie, leave, loadAccount, sessionHeaders } from '~/lib/account.server'
import { cacheControl } from '~/lib/cache'
import { localeOfPath } from '~/lib/locale'
import { localePath } from '~/lib/paths'

// The customer's own page (plan/10-api/11-account.md): their details and the orders linked to the account. Private, never kept, never indexed.
export const headers = /** @type {import('./+types/account').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.private, 'X-Robots-Tag': 'noindex' }))
export const meta = /** @type {import('./+types/account').Route.MetaFunction} */ (({ matches }) => privateMeta(matches, 'account'))

/** @param {import('./+types/account').Route.LoaderArgs} props */
export async function loader({ request }) {
  const locale = localeOfPath(new URL(request.url).pathname)
  const account = await loadAccount(request)
  // an expired session is cleared and the visitor asked to sign in again
  if (!account) throw redirect(localePath(locale, '/account/login'), { headers: { 'Set-Cookie': clearSessionCookie() } })
  const orders = await api('account.orders', { headers: /** @type {Record<string, string>} */ (sessionHeaders(request)) })
  return data({ account, orders: orders.items })
}

/** @param {import('./+types/account').Route.ActionArgs} props */
export async function action({ request }) {
  const form = await request.formData()
  const locale = localeOfPath(new URL(request.url).pathname)
  if (form.get('intent') === 'signout') {
    await leave(request)
    throw redirect(localePath(locale, '/'), { status: 303, headers: { 'Set-Cookie': clearSessionCookie() } })
  }
  const result = await accountAction(request, form)
  if (result.ok && result.done === 'deleted') throw redirect(localePath(locale, '/'), { status: 303, headers: { 'Set-Cookie': clearSessionCookie() } })
  // a changed password ended the other sessions: this one stays, so the page simply answers
  return data(result)
}

export default function Account() {
  const { account, orders } = useLoaderData()
  const result = useActionData()
  return <AccountPage account={account} orders={orders} result={result} />
}
