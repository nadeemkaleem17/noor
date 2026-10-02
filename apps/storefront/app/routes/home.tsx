import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { createI18n } from '@noor/i18n'
import { cacheControl } from '~/lib/cache'
import { localeFromParams } from '~/lib/locale'
import type { Route } from './+types/home'

export const headers: Route.HeadersFunction = () => ({ 'Cache-Control': cacheControl.listing })

export function loader({ params }: Route.LoaderArgs) {
  const i18n = createI18n(localeFromParams(params))
  return { title: i18n.t('storefront:home.title'), description: i18n.t('storefront:home.tagline') }
}

export const meta: Route.MetaFunction = ({ loaderData }) => [{ title: loaderData.title }, { name: 'description', content: loaderData.description }]

export default function Home({ params }: Route.ComponentProps) {
  const { t } = useTranslation('storefront')
  const isUrdu = params.locale === 'ur'
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="font-heading text-4xl">{t('home.title')}</h1>
      <p className="mt-2 text-fg-soft">{t('home.tagline')}</p>
      <p className="mt-4">{t('home.items', { count: 2 })}</p>
      <Link to={isUrdu ? '/' : '/ur'} lang={isUrdu ? 'en' : 'ur'} className="mt-6 inline-block text-accent-text underline">
        {t('language.switch')}
      </Link>
    </main>
  )
}
