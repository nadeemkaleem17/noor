import { Check } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useFetcher, useRevalidator } from 'react-router'
import { formatDate, formatMoney } from '@noor/i18n'
import { StatusBadge } from '@noor/ui/badge'
import { Button, LinkButton } from '@noor/ui/button'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { Image, imageProps } from '@noor/ui/image'
import { Link } from '@noor/ui/link'
import { useHydrated } from '../catalog/filters'
import { ShopPrice as Price } from '../catalog/shop-price'
import { useLocalePath, useShell } from '../layout/use-shell'
import { ReturnRequests } from './returns'

/** @typedef {import('@noor/contract').OrderPublic} Order */

const finalStatuses = ['delivered', 'cancelled', 'returned']
/** The reasons a customer is told; the others (a suspected fake, "other") are the shop's own business. */
const reasonsShown = ['customer_request', 'unreachable', 'duplicate', 'out_of_stock', 'payment_expired']

/** A link to the shop's WhatsApp about this order: only its number goes in the message, never the link of the page, the phone or the address (section 5). @param {{ number: string | undefined, orderNumber: string, children: import('react').ReactNode }} props */
function WhatsAppLink({ number, orderNumber, children }) {
  const { t } = useTranslation('storefront')
  if (!number) return null
  return (
    <Link href={`https://wa.me/${number}?text=${encodeURIComponent(t('order.waText', { orderNo: orderNumber }))}`} className="underline underline-offset-4">
      {children}
    </Link>
  )
}

/** What happens next, by status (section 4.2). @param {{ order: Order, whatsapp: string | undefined }} props */
function NextStep({ order, whatsapp }) {
  const { t } = useTranslation('storefront')
  const shell = useShell()
  const locale = shell?.locale ?? 'en'
  const money = (/** @type {import('@noor/contract').Money} */ m) => formatMoney(m, locale, shell?.config.priceDisplay)
  const at = (/** @type {string} */ step) => order.timeline.find((x) => x.step === step)?.at
  const lead = order.lines.find((l) => l.leadTime)?.leadTime
  /** @type {import('react').ReactNode} */
  let body
  if (order.status === 'pending') {
    body = order.bankTransfer ? (
      <>
        <p>{t('order.next.bank')}</p>
        <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-fg-soft">{t('order.bank.title')}</dt><dd>{order.bankTransfer.accountTitle}</dd>
          <dt className="text-fg-soft">{t('order.bank.bank')}</dt><dd>{order.bankTransfer.bank}</dd>
          <dt className="text-fg-soft">{t('order.bank.number')}</dt><dd dir="ltr">{order.bankTransfer.accountNumber}</dd>
        </dl>
        {order.bankTransfer.instructions ? <p className="mt-2 text-sm">{order.bankTransfer.instructions}</p> : null}
        <p className="mt-2"><WhatsAppLink number={whatsapp} orderNumber={order.orderNumber}>{t('order.bank.receipt')}</WhatsAppLink></p>
      </>
    ) : (
      <p>{t('order.next.pending')}</p>
    )
  } else if (order.status === 'pending_confirmation') {
    body = (
      <>
        <p>{t('order.next.pending_confirmation', { phone: order.customer.phoneMasked })}</p>
        {order.depositDue ? <p className="mt-1 text-sm">{t('order.next.deposit', { amount: money(order.depositDue) })}</p> : null}
      </>
    )
  } else if (order.status === 'confirmed') {
    body = <p>{lead ? t('order.next.confirmedMade', { days: lead.maxDays }) : t('order.next.confirmed')}</p>
  } else if (order.status === 'dispatched') {
    const tracking = order.delivery.trackingUrl
    body = (
      <>
        <p>{order.delivery.courier ? t('order.next.dispatchedWith', { courier: order.delivery.courier }) : t('order.next.dispatched')}{order.delivery.trackingNumber ? ` ${t('order.next.trackingNo', { n: order.delivery.trackingNumber })}` : ''}</p>
        {tracking ? <p className="mt-1"><Link href={tracking} className="underline underline-offset-4">{t('order.next.trackWithCourier')}</Link></p> : null}
        {order.paymentMethod === 'cod' && order.dueOnDelivery.amount > 0 ? <p className="mt-1 text-sm">{t('order.next.keepReady', { amount: money(order.dueOnDelivery) })}</p> : null}
      </>
    )
  } else if (order.status === 'delivered') {
    const when = at('delivered')
    body = <p>{when ? t('order.next.deliveredOn', { date: formatDate(when, locale) }) : t('order.next.delivered')}</p>
  } else {
    return null // cancelled and returned have their banner instead
  }
  return <div className="rounded-card border border-line-strong bg-accent-soft p-4">{body}</div>
}

/** The four steps, the current one marked (section 4.2). @param {{ order: Order }} props */
function Timeline({ order }) {
  const { t } = useTranslation('storefront')
  const locale = useShell()?.locale ?? 'en'
  return (
    <ol aria-label={t('order.timeline')} className="flex flex-col gap-3">
      {order.timeline.map((s) => (
        <li key={s.step} aria-current={s.current ? 'step' : undefined} className="flex items-center gap-3">
          <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-full border ${s.at ? 'border-accent bg-accent text-on-accent' : 'border-line-strong'}`}>{s.at ? <Check className="size-4" /> : null}</span>
          <span className={s.current ? 'font-medium' : s.at ? '' : 'text-fg-soft'}>{t(`order.step.${s.step}`)}</span>
          {s.at ? <span className="ms-auto text-sm text-fg-soft">{formatDate(s.at, locale, { dateStyle: 'medium', timeStyle: 'short' })}</span> : null}
        </li>
      ))}
    </ol>
  )
}

/** Cancel, with a question first: a dialog with JavaScript, a fold-out with a button without it (section 4.3). @param {{ order: Order }} props */
function CancelOrder({ order }) {
  const { t } = useTranslation('storefront')
  const hydrated = useHydrated()
  const fetcher = useFetcher()
  if (hydrated) {
    return (
      <ConfirmDialog
        title={t('order.cancel.title', { number: order.orderNumber })}
        body={t('order.cancel.body')}
        confirmLabel={t('order.cancel.confirm')}
        cancelLabel={t('order.cancel.keep')}
        trigger={<Button variant="secondary">{t('order.cancel.button')}</Button>}
        onConfirm={async () => {
          await fetcher.submit({ intent: 'cancel' }, { method: 'post' })
        }}
      />
    )
  }
  return (
    <details>
      <summary className="inline-flex h-(--control-h) cursor-pointer items-center rounded-control border border-line-strong px-4">{t('order.cancel.button')}</summary>
      <fetcher.Form method="post" className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="intent" value="cancel" />
        <p>{t('order.cancel.body')}</p>
        <Button type="submit" variant="secondary">{t('order.cancel.confirm')}</Button>
      </fetcher.Form>
    </details>
  )
}

/**
 * The order page (plan/06-storefront/06-orders-tracking.md section 4): one page for the link people are sent and for the lookup. Everything shown is what the API sent, already masked; what the
 * customer may do is what the API lists in `allowedActions`. While the order is not in a final state the page asks again every minute and when the tab comes back.
 * @param {{ order: Order, placed: boolean, reviewed: boolean, whatsapp: string | undefined, token: string, requested?: string | undefined, error?: string | undefined }} props
 */
export function OrderPage({ order, placed, reviewed, whatsapp, token, requested, error }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const shell = useShell()
  const locale = shell?.locale ?? 'en'
  const hydrated = useHydrated()
  const revalidator = useRevalidator()
  const toCod = useFetcher()
  const buyAgain = useFetcher()
  const closed = order.closed
  const live = !finalStatuses.includes(order.status)

  useEffect(() => {
    if (!live) return
    const ask = () => {
      if (document.visibilityState === 'visible') void revalidator.revalidate()
    }
    const timer = window.setInterval(ask, 60_000)
    document.addEventListener('visibilitychange', ask)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', ask)
    }
  }, [live, revalidator])

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 print:max-w-none">
      <header>
        <h1 className="font-heading text-h1">{placed ? t('order.thanks', { name: order.customer.firstName }) : t('order.title', { number: order.orderNumber })}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-fg-soft">
          <span>{placed ? `${t('order.number', { number: order.orderNumber })} · ` : ''}{formatDate(order.placedAt, locale)}</span>
          <StatusBadge status={order.status} />
        </p>
      </header>

      {error ? <p role="alert" className="mt-4 rounded-card bg-danger-soft p-3 text-sm">{t(`order.errors.${error}`)}</p> : null}
      {reviewed ? <p role="status" className="mt-4 rounded-card bg-success-soft p-3 text-sm">{t('order.reviewed')}</p> : null}

      <div className="mt-6 flex flex-col gap-6">
        {closed ? (
          <div role="status" className="rounded-card bg-danger-soft p-4">
            <p className="font-medium">{t(`order.closed.${closed.status}`, { date: formatDate(closed.at, locale) })}</p>
            {closed.reason && reasonsShown.includes(closed.reason) ? <p className="mt-1 text-sm">{t(`order.reasons.${closed.reason}`)}</p> : null}
            {order.paid.amount > 0 ? <p className="mt-1 text-sm">{t('order.closed.refund')}</p> : null}
          </div>
        ) : (
          <>
            <NextStep order={order} whatsapp={whatsapp} />
            <Timeline order={order} />
          </>
        )}

        <section aria-labelledby="order-items">
          <h2 id="order-items" className="mb-2 font-heading text-h3">{t('order.items')}</h2>
          <ul className="divide-y divide-line">
            {order.lines.map((l) => (
              <li key={l.id} className="flex gap-3 py-3">
                {l.image ? <Image {...imageProps(l.image)} alt="" sizes="64px" ratio="3 / 4" className="w-14 shrink-0 rounded-control bg-surface-2" /> : <div className="aspect-3/4 w-14 shrink-0 rounded-control bg-surface-2" />}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{l.title}</p>
                  <p className="text-fg-soft">{[l.variantLabel, t('checkout.qty', { n: l.quantity })].filter(Boolean).join(' · ')}</p>
                  {l.customizationSummary ? <p className="text-fg-soft">{l.customizationSummary}</p> : null}
                  {order.status === 'delivered' && l.review?.available ? (
                    l.review.submitted ? (
                      <p className="mt-1 text-fg-soft">{t('order.reviewSubmitted')}</p>
                    ) : (
                      <p className="mt-1"><RouterLink to={path(`/orders/${token}/review/${l.id}`)} className="underline underline-offset-4">{t('order.writeReview')}</RouterLink></p>
                    )
                  ) : null}
                </div>
                <Price money={l.lineTotal} size="sm" />
              </li>
            ))}
          </ul>
          <dl className="mt-2 flex flex-col gap-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><dt>{t('cart.subtotal')}</dt><dd><Price money={order.subtotal} size="sm" /></dd></div>
            {order.discount.amount > 0 ? <div className="flex justify-between"><dt>{t('cart.discount')}{order.promoCode ? ` (${order.promoCode})` : ''}</dt><dd>−<Price money={order.discount} size="sm" /></dd></div> : null}
            <div className="flex justify-between"><dt>{t('cart.shipping')}</dt><dd>{order.shippingFee.amount === 0 ? t('cart.free') : <Price money={order.shippingFee} size="sm" />}</dd></div>
            <div className="flex items-baseline justify-between border-t border-line pt-2 font-medium"><dt>{t('cart.total')}</dt><dd><Price money={order.total} size="lg" /></dd></div>
            {order.depositDue ? <div className="flex justify-between text-fg-soft"><dt>{t('checkout.depositNow')}</dt><dd><Price money={order.depositDue} size="sm" /></dd></div> : null}
            {order.paid.amount > 0 ? <div className="flex justify-between text-fg-soft"><dt>{t('order.paid')}</dt><dd><Price money={order.paid} size="sm" /></dd></div> : null}
            {order.dueOnDelivery.amount > 0 ? <div className="flex justify-between text-fg-soft"><dt>{t('checkout.dueOnDelivery')}</dt><dd><Price money={order.dueOnDelivery} size="sm" /></dd></div> : null}
          </dl>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-fg-soft">{order.paymentLabel} <StatusBadge status={order.paymentStatus} /></p>
        </section>

        <section aria-labelledby="order-delivery">
          <h2 id="order-delivery" className="mb-2 font-heading text-h3">{t('order.delivering')}</h2>
          <p className="text-sm">{order.customer.firstName} · {order.delivery.city} · <bdi>{order.delivery.addressMasked}</bdi></p>
          <p className="text-sm text-fg-soft">{order.delivery.methodLabel}{order.delivery.eta ? ` · ${t('order.eta', { from: formatDate(order.delivery.eta.from, locale), to: formatDate(order.delivery.eta.to, locale) })}` : ''}</p>
        </section>

        <ReturnRequests order={order} requested={requested} />

        <div className="flex flex-wrap items-center gap-3 print:hidden">
          {order.allowedActions.includes('cancel') ? <CancelOrder order={order} /> : <WhatsAppNeedCancel number={whatsapp} order={order} />}
          {order.allowedActions.includes('switch_to_cod') ? (
            <toCod.Form method="post">
              <input type="hidden" name="intent" value="switchToCod" />
              <Button type="submit" variant="secondary" loading={toCod.state !== 'idle'}>{t('order.switchToCod')}</Button>
            </toCod.Form>
          ) : null}
          {whatsapp ? (
            <LinkButton href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(t('order.waText', { orderNo: order.orderNumber }))}`} variant="secondary">{t('order.whatsapp')}</LinkButton>
          ) : null}
          {order.lines.some((l) => l.variantId) ? (
            <buyAgain.Form method="post">
              <input type="hidden" name="intent" value="buyAgain" />
              <Button type="submit" variant="secondary" loading={buyAgain.state !== 'idle'}>{t('order.buyAgain')}</Button>
            </buyAgain.Form>
          ) : null}
          {hydrated ? <Button variant="ghost" onClick={() => window.print()}>{t('order.print')}</Button> : null}
        </div>
      </div>
    </div>
  )
}

/** Once the shop has the order in hand it cannot be cancelled here: the way is WhatsApp. @param {{ number: string | undefined, order: Order }} props */
function WhatsAppNeedCancel({ number, order }) {
  const { t } = useTranslation('storefront')
  if (!number || finalStatuses.includes(order.status)) return null
  return <p className="text-sm text-fg-soft"><WhatsAppLink number={number} orderNumber={order.orderNumber}>{t('order.needCancel')}</WhatsAppLink></p>
}
