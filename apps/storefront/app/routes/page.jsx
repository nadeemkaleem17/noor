import { useTranslation } from 'react-i18next'
import { cacheControl } from '~/lib/cache'

export const headers = /** @type {import('./+types/page').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.content }))

// ponytail: the page itself is built in its own task (plan/16-roadmap.md section 5); until then it answers with the right cache class and says so.
export default function Page() {
  const { t } = useTranslation('storefront')
  return (
    <div className="mx-auto max-w-2xl p-8">
      <p className="text-fg-soft">{t('stub.soon')}</p>
    </div>
  )
}
