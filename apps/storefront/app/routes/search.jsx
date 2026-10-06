import { useTranslation } from 'react-i18next'
import { cacheControl } from '~/lib/cache'
import { useLocalePath } from '~/features/layout/use-shell'

export const headers = /** @type {import('./+types/search').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.private }))

// ponytail: the results come with the listings task (M5-03); the form is here so the search link of the header works without JavaScript.
export default function Search() {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  return (
    <div className="mx-auto max-w-2xl p-8">
      <form role="search" method="get" action={path('/search')} className="flex gap-2">
        <label className="sr-only" htmlFor="q">
          {t('shell.searchLabel')}
        </label>
        <input id="q" name="q" type="search" required minLength={2} maxLength={80} placeholder={t('shell.searchPlaceholder')} className="h-(--control-h) flex-1 rounded-control border border-line-strong bg-bg px-3" />
        <button type="submit" className="h-(--control-h) rounded-control bg-accent px-5 font-medium text-on-accent">
          {t('shell.searchSubmit')}
        </button>
      </form>
    </div>
  )
}
