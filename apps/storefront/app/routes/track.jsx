import { useTranslation } from 'react-i18next'
import { privateMeta } from '~/features/seo/meta'
import { data, Form, redirect, useActionData, useNavigation } from 'react-router'
import { Button } from '@noor/ui/button'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { Link } from '@noor/ui/link'
import { useLocalePath, useShell } from '~/features/layout/use-shell'
import { cacheControl } from '~/lib/cache'
import { localeOfPath } from '~/lib/locale'
import { trackOrder } from '~/lib/orders.server'
import { localePath } from '~/lib/paths'

export const headers = /** @type {import('./+types/track').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.private, 'X-Robots-Tag': 'noindex' }))
export const meta = /** @type {import('./+types/track').Route.MetaFunction} */ (({ matches }) => privateMeta(matches, 'track'))

/**
 * The lookup (plan/06-storefront/06-orders-tracking.md section 3): the order number and the mobile number together find the order; a match goes to its page, anything else says the same thing.
 * @param {import('./+types/track').Route.ActionArgs} props
 */
export async function action({ request }) {
  const form = await request.formData()
  const found = await trackOrder(form)
  if (found.ok) throw redirect(localePath(localeOfPath(new URL(request.url).pathname), `/orders/${found.token}`), 303)
  // what was typed comes back, so a mistyped digit is not typed again
  return data({ error: found.error, orderNumber: String(form.get('orderNumber') ?? ''), phone: String(form.get('phone') ?? '') })
}

export default function Track() {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const whatsapp = useShell()?.config.contact.whatsapp
  const result = useActionData()
  const navigation = useNavigation()
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="font-heading text-3xl">{t('track.title')}</h1>
      <Form method="post" action={path('/track')} className="mt-6 flex flex-col gap-4">
        <Field label={t('track.orderNumber')} required hint={t('track.orderNumberHint')}>
          <Input name="orderNumber" required maxLength={40} autoCapitalize="characters" autoComplete="off" placeholder="RB-10458" defaultValue={result?.orderNumber ?? ''} dir="ltr" />
        </Field>
        <Field label={t('track.phone')} required>
          <Input name="phone" type="tel" inputMode="tel" required autoComplete="tel" placeholder="03xx xxxxxxx" defaultValue={result?.phone ?? ''} dir="ltr" />
        </Field>
        {result?.error ? <p role="alert" className="text-danger">{t(`track.errors.${result.error}`)}</p> : null}
        <Button type="submit" loading={navigation.state !== 'idle'} size="lg" fullWidth>{t('track.submit')}</Button>
      </Form>
      {whatsapp ? <p className="mt-6 text-sm text-fg-soft"><Link href={`https://wa.me/${whatsapp}`} className="underline underline-offset-4">{t('track.whatsapp')}</Link></p> : null}
    </div>
  )
}
