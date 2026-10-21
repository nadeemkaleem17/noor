import { data, redirect, useActionData } from 'react-router'
import { AuthForm } from '~/features/account/auth-form'
import { privateMeta } from '~/features/seo/meta'
import { enter, loadAccount, sessionCookie } from '~/lib/account.server'
import { cacheControl } from '~/lib/cache'
import { localeOfPath } from '~/lib/locale'
import { localePath } from '~/lib/paths'

// Signing in and registering (plan/10-api/11-account.md): two forms on two addresses, one module. Private, never kept, never indexed.
export const headers = /** @type {import('./+types/account-enter').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.private, 'X-Robots-Tag': 'noindex' }))
export const meta = /** @type {import('./+types/account-enter').Route.MetaFunction} */ (({ matches }) => privateMeta(matches, 'account'))

/** @param {Request} request */
const kindOf = (request) => (new URL(request.url).pathname.replace(/\.data$/, '').replace(/\/+$/, '').endsWith('/register') ? /** @type {const} */ ('register') : /** @type {const} */ ('login'))

/** Someone already signed in has nothing to do here. @param {import('./+types/account-enter').Route.LoaderArgs} props */
export async function loader({ request }) {
  const locale = localeOfPath(new URL(request.url).pathname)
  if (await loadAccount(request)) throw redirect(localePath(locale, '/account'))
  return data({ kind: kindOf(request) })
}

/** @param {import('./+types/account-enter').Route.ActionArgs} props */
export async function action({ request }) {
  const form = await request.formData()
  const kind = kindOf(request)
  const result = await enter(request, form, kind)
  if (result.ok) throw redirect(localePath(localeOfPath(new URL(request.url).pathname), '/account'), { status: 303, headers: { 'Set-Cookie': sessionCookie(result.token) } })
  // what was typed comes back, except the password
  return data({ error: result.error, reason: 'reason' in result ? result.reason : undefined, fields: 'fields' in result ? result.fields : [], values: { name: String(form.get('name') ?? ''), phone: String(form.get('phone') ?? ''), email: String(form.get('email') ?? '') } })
}

export default function AccountEnter() {
  const result = useActionData()
  return <AuthForm result={result} />
}
