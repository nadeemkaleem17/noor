import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { createI18n } from '@noor/i18n'
import { cacheControl } from '~/lib/cache'
import { useShell } from '~/features/layout/use-shell'
import { localeOfPath } from '~/lib/locale'

export const headers = /** @type {import('./+types/home').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.listing }))

/**
 * @param {import('./+types/home').Route.LoaderArgs} props
 */
export function loader({ request }) {
  const i18n = createI18n(localeOfPath(new URL(request.url).pathname))
  return { title: i18n.t('storefront:home.title'), description: i18n.t('storefront:home.tagline') }
}

export const meta = /** @type {import('./+types/home').Route.MetaFunction} */ (({ loaderData }) => [{ title: loaderData.title }, { name: 'description', content: loaderData.description }])

// ponytail: the real home page is M5-02; this keeps the first page answering inside the shell.
export default function Home() {
  const { t } = useTranslation('storefront')
  const isUrdu = useShell()?.locale === 'ur'
  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="font-heading text-4xl">{t('home.title')}</h1>
      <p className="mt-2 text-fg-soft">{t('home.tagline')}</p>
      <Link to={isUrdu ? '/' : '/ur'} lang={isUrdu ? 'en' : 'ur'} reloadDocument className="mt-6 inline-block text-accent-text underline">
        {t('language.switch')}
      </Link>
    </div>
  )
}
