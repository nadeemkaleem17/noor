import { useTranslation } from 'react-i18next'
import { privateMeta } from '~/features/seo/meta'
import { data, Link } from 'react-router'
import { useLocalePath, useShell } from '~/features/layout/use-shell'

export const headers = /** @type {import('./+types/not-found').Route.HeadersFunction} */ (() => ({ 'Cache-Control': 'public, s-maxage=60' }))

// The shop's own page for an address it does not know (plan/06-storefront/01-sitemap.md section 6): a 404 status, and a way on.
export function loader() {
  return data(null, { status: 404 })
}

export const meta = /** @type {import('./+types/not-found').Route.MetaFunction} */ (({ matches }) => privateMeta(matches, 'notFound'))

export default function NotFound() {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const categories = useShell()?.categories ?? []
  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="font-heading text-3xl">{t('notFound.title')}</h1>
      <p className="mt-2 text-fg-soft">{t('notFound.body')}</p>
      <form role="search" method="get" action={path('/search')} className="mt-6 flex gap-2">
        <label className="sr-only" htmlFor="nf-q">
          {t('shell.searchLabel')}
        </label>
        <input id="nf-q" name="q" type="search" required minLength={2} maxLength={80} placeholder={t('shell.searchPlaceholder')} className="h-(--control-h) flex-1 rounded-control border border-line-strong bg-bg px-3" />
        <button type="submit" className="h-(--control-h) rounded-control bg-accent px-5 font-medium text-on-accent">
          {t('shell.searchSubmit')}
        </button>
      </form>
      <p className="mt-6 text-fg-soft">{t('notFound.browse')}</p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 underline underline-offset-4">
        <li>
          <Link to={path('/')}>{t('notFound.home')}</Link>
        </li>
        <li>
          <Link to={path('/new')}>{t('shell.new')}</Link>
        </li>
        {categories.slice(0, 6).map((c) => (
          <li key={c.id}>
            <Link to={path(`/c/${c.handle}`)}>{c.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
