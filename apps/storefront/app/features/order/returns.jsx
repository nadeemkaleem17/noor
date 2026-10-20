import { useTranslation } from 'react-i18next'
import { useFetcher } from 'react-router'
import { formatDate, formatMoney } from '@noor/i18n'
import { Badge } from '@noor/ui/badge'
import { Button } from '@noor/ui/button'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { Textarea } from '@noor/ui/textarea'
import { enums } from '@noor/contract'
import { useShell } from '../layout/use-shell'

/** @typedef {import('@noor/contract').OrderPublic} Order */
const tone = /** @type {const} */ ({ requested: 'warning', approved: 'accent', received: 'accent', completed: 'success', declined: 'danger' })

/**
 * Returns and exchanges on the order page (plan/06-storefront/14-site-blueprint.md RT-02, RT-03): the requests made so far, and a form while the shop still takes one. What can be asked
 * for is what the API listed (`returnable` per line, `eligibleUntil`); the form is a plain POST to the order route, so it works without JavaScript.
 * @param {{ order: Order, requested?: string | undefined }} props
 */
export function ReturnRequests({ order, requested: requestedByPost }) {
  const { t } = useTranslation('storefront')
  const shell = useShell()
  const locale = shell?.locale ?? 'en'
  const fetcher = useFetcher()
  const offer = order.returns
  if (!offer) return null
  // with JavaScript the answer comes to the fetcher, without it to the page after a full post
  const answer = /** @type {{ ok: boolean, requested?: string, error?: string } | undefined} */ (fetcher.data)
  const requested = answer?.ok ? answer.requested : requestedByPost
  const failed = answer && !answer.ok ? answer.error : undefined
  const lines = order.lines.filter((l) => (l.returnable ?? 0) > 0)
  return (
    <section aria-labelledby="order-returns" className="print:hidden">
      <h2 id="order-returns" className="mb-2 font-heading text-h3">{t('order.returns.title')}</h2>
      {failed ? <p role="alert" className="mb-3 rounded-card bg-danger-soft p-3 text-sm">{t(`order.errors.${failed}`)}</p> : null}
      {requested ? <p role="status" className="mb-3 rounded-card bg-success-soft p-3 text-sm">{t('order.returns.sent', { number: requested })}</p> : null}

      {offer.requests.length > 0 ? (
        <ul className="mb-3 flex flex-col gap-2">
          {offer.requests.map((r) => (
            <li key={r.number} className="rounded-card border border-line p-3 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.number} · {t(`order.returns.kindShort.${r.kind}`)}</span>
                <Badge tone={tone[r.status]}>{t(`order.returns.status.${r.status}`)}</Badge>
                <span className="text-fg-soft">{formatDate(r.requestedAt, locale)}</span>
              </p>
              <p className="mt-1 text-fg-soft">{r.lines.map((l) => `${l.title}${l.variantLabel ? ` (${l.variantLabel})` : ''} × ${l.quantity}`).join(', ')}</p>
              {r.decisionNote ? <p className="mt-1">{t('order.returns.note2', { note: r.decisionNote })}</p> : null}
              {r.pickupOn ? <p className="mt-1">{t('order.returns.pickup', { date: formatDate(r.pickupOn, locale) })}</p> : null}
              {r.refund ? <p className="mt-1">{t('order.returns.refund', { amount: formatMoney(r.refund, locale, shell?.config.priceDisplay) })}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {offer.eligibleUntil ? (
        <details key={requested ?? 'ask'}>
          <summary className="inline-flex h-(--control-h) cursor-pointer items-center rounded-control border border-line-strong px-4">{t('order.returns.ask')}</summary>
          <fetcher.Form method="post" className="mt-3 flex flex-col gap-4">
            <input type="hidden" name="intent" value="return" />
            <p className="text-sm text-fg-soft">{t('order.returns.until', { date: formatDate(offer.eligibleUntil, locale) })}</p>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{t('order.returns.kind')}</legend>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="kind" value="return" defaultChecked /> {t('order.returns.kindReturn')}</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="kind" value="exchange" /> {t('order.returns.kindExchange')}</label>
            </fieldset>
            {lines.map((l) => (
              <Field key={l.id} label={t('order.returns.pieces', { title: l.variantLabel ? `${l.title} (${l.variantLabel})` : l.title })} hint={t('order.returns.piecesHint', { n: l.returnable })}>
                <Input name={`qty_${l.id}`} type="number" inputMode="numeric" min={0} max={l.returnable} defaultValue={lines.length === 1 ? 1 : 0} />
              </Field>
            ))}
            <Field label={t('order.returns.reason')}>
              <NativeSelect name="reason" defaultValue="wrong_size" options={enums.returnReason.map((v) => ({ value: v, label: t(`order.returns.reasonOptions.${v}`) }))} />
            </Field>
            <Field label={t('order.returns.exchangeNote')}>
              <Input name="exchangeNote" maxLength={200} />
            </Field>
            <Field label={t('order.returns.note')} hint={t('order.returns.photos')}>
              <Textarea name="note" rows={3} maxLength={500} />
            </Field>
            <div><Button type="submit" loading={fetcher.state !== 'idle'}>{t('order.returns.submit')}</Button></div>
          </fetcher.Form>
        </details>
      ) : order.status === 'delivered' && offer.requests.length === 0 ? (
        <p className="text-sm text-fg-soft">{t('order.returns.expired', { days: offer.windowDays })}</p>
      ) : null}
    </section>
  )
}
