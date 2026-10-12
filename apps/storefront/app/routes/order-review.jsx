import { useTranslation } from 'react-i18next'
import { privateMeta } from '~/features/seo/meta'
import { data, Link as RouterLink, redirect, useActionData, useLoaderData } from 'react-router'
import { useLocalePath } from '~/features/layout/use-shell'
import { ReviewForm, Reviewed } from '~/features/order/review-form'
import { cacheControl } from '~/lib/cache'
import { localeOfPath } from '~/lib/locale'
import { loadInvite, sendReview } from '~/lib/orders.server'
import { localePath } from '~/lib/paths'
import { loadShell } from '~/lib/shell.server'

// reached by the link of an order, so it keeps the order's rules: private, not indexed, no referrer (security.server.js)
export const headers = /** @type {import('./+types/order-review').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.private, 'X-Robots-Tag': 'noindex' }))
export const meta = /** @type {import('./+types/order-review').Route.MetaFunction} */ (({ matches }) => privateMeta(matches, 'review'))

/** @param {import('./+types/order-review').Route.LoaderArgs} props */
export async function loader({ params, request }) {
  const { config } = await loadShell(localeOfPath(new URL(request.url).pathname))
  // without reviews in the shop there is no such page
  if (!config.features.reviews) throw new Response('Not Found', { status: 404 })
  return data({ invite: await loadInvite(params.token ?? '', params.lineId ?? ''), token: params.token ?? '', lineId: params.lineId ?? '' })
}

/** @param {import('./+types/order-review').Route.ActionArgs} props */
export async function action({ params, request }) {
  const form = await request.formData()
  const result = await sendReview(params.token ?? '', params.lineId ?? '', form)
  if (result.ok) throw redirect(localePath(localeOfPath(new URL(request.url).pathname), `/orders/${params.token}?reviewed=1`), 303)
  return data({ ...result, values: Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string')) })
}

export default function OrderReview() {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const { invite, token, lineId } = useLoaderData()
  const result = useActionData()
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="font-heading text-3xl">{t('review.title')}</h1>
      <Reviewed image={invite.product.image} title={invite.product.title} />
      {invite.submitted || result?.error === 'already' ? (
        <p role="status" className="mt-6">{t('review.already')}</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-fg-soft">{t('review.intro')}</p>
          <ReviewForm invite={invite} token={token} lineId={lineId} result={result} values={result?.values ?? {}} />
        </>
      )}
      <p className="mt-6"><RouterLink to={path(`/orders/${token}`)} className="underline underline-offset-4">{t('review.back')}</RouterLink></p>
    </div>
  )
}
