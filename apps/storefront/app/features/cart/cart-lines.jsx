import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useFetcher } from 'react-router'
import { formatMoney } from '@noor/i18n'
import { Button, IconButton } from '@noor/ui/button'
import { Image, imageProps } from '@noor/ui/image'
import { ShopPrice as Price } from '../catalog/shop-price'
import { QuantityStepper } from '@noor/ui/quantity-stepper'
import { useToast } from '@noor/ui/toast'
import { useHydrated } from '../catalog/filters'
import { useLocalePath, useShell } from '../layout/use-shell'

/** @typedef {import('@noor/contract').CartLine} CartLine */

/** What a line says about itself that the visitor must know before paying: the price moved, little is left, it is gone (plan/06-storefront/05-cart-checkout.md section 3). @param {{ line: CartLine }} props */
function Issues({ line }) {
  const { t } = useTranslation('storefront')
  const shell = useShell()
  const money = (/** @type {import('@noor/contract').Money} */ m) => formatMoney(m, shell?.locale ?? 'en', shell?.config.priceDisplay)
  return line.issues.length ? (
    <ul className="flex flex-col gap-0.5 text-sm text-warning">
      {line.issues.map((i) => (
        <li key={i}>
          {i === 'price_changed' ? t('cart.issues.price_changed', { amount: money(line.unitPrice) }) : i === 'low_stock' ? t('cart.issues.low_stock', { n: line.available ?? 0 }) : t(`cart.issues.${i}`)}
        </li>
      ))}
    </ul>
  ) : null
}

/**
 * One line of the cart. The quantity follows the visitor at once (what the form says is on its way) while the totals, which only the API can work out, wait for its answer; a removed line
 * is gone at once. Without JavaScript the quantity is a number and an Update button, and Remove is a button of its own.
 * @param {{ line: CartLine, compact?: boolean, onRemoved: (line: CartLine) => void }} props
 */
function Line({ line, compact, onRemoved }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const hydrated = useHydrated()
  const fetcher = useFetcher()
  const action = path('/cart')
  const intent = fetcher.formData?.get('intent')
  // gone at once; the component stays so the request is not cancelled before the cart comes back
  if (intent === 'remove') return null
  const quantity = intent === 'setQty' ? Number(fetcher.formData?.get('quantity')) : line.quantity
  const max = Math.max(1, Math.min(line.available ?? 99, line.maxPerOrder))
  const fail = fetcher.data && !fetcher.data.ok ? fetcher.data : undefined
  const to = path(`/p/${line.handle}`)

  return (
    <li className="flex gap-4 border-b border-line py-4">
      <RouterLink to={to} className="shrink-0" tabIndex={-1} aria-hidden="true">
        {line.image ? <Image {...imageProps(line.image)} alt="" sizes="96px" ratio="3 / 4" className={`${compact ? 'w-16' : 'w-24'} rounded-control bg-surface-2`} /> : <div className={`${compact ? 'w-16' : 'w-24'} aspect-3/4 rounded-control bg-surface-2`} />}
      </RouterLink>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <RouterLink to={to} className="font-medium underline-offset-4 hover:underline">{line.title}</RouterLink>
          <fetcher.Form method="post" action={action}>
            <input type="hidden" name="intent" value="remove" />
            <input type="hidden" name="lineId" value={line.id} />
            {hydrated ? <input type="hidden" name="mode" value="fetch" /> : null}
            <IconButton
              type="submit"
              label={t('cart.remove', { title: line.title })}
              icon={<Trash2 aria-hidden="true" className="size-5" />}
              size="sm"
              onClick={hydrated ? () => onRemoved(line) : undefined}
            />
          </fetcher.Form>
        </div>
        {line.variantLabel ? <p className="text-sm text-fg-soft">{line.variantLabel}</p> : null}
        {line.customization?.summary ? <p className="text-sm text-fg-soft">{line.customization.summary}</p> : null}
        {line.madeToOrder ? <p className="text-sm text-fg-soft">{t('cart.madeToOrder', { min: line.madeToOrder.leadMinDays, max: line.madeToOrder.leadMaxDays })}</p> : null}
        <Issues line={line} />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <fetcher.Form method="post" action={action} className="flex items-center gap-2">
            <input type="hidden" name="intent" value="setQty" />
            <input type="hidden" name="lineId" value={line.id} />
            {hydrated ? (
              <QuantityStepper
                value={quantity}
                min={1}
                max={max}
                label={t('cart.quantityOf', { title: line.title })}
                maxMessage={t('cart.maxQuantity', { n: max })}
                onValueChange={(q) => { if (q !== line.quantity) void fetcher.submit({ intent: 'setQty', lineId: line.id, quantity: q, mode: 'fetch' }, { method: 'post', action }) }}
              />
            ) : (
              <>
                <label className="sr-only" htmlFor={`q-${line.id}`}>{t('cart.quantityOf', { title: line.title })}</label>
                <input id={`q-${line.id}`} type="number" name="quantity" min={0} max={max} defaultValue={line.quantity} className="h-11 w-20 rounded-control border border-line-strong bg-surface px-3" />
                <Button type="submit" variant="secondary" size="sm">{t('cart.update')}</Button>
              </>
            )}
          </fetcher.Form>
          <p className="flex flex-col items-end gap-0.5 text-end">
            <Price money={line.lineSubtotal} />
            {line.quantity > 1 ? <span className="text-sm text-muted">{t('cart.each')} <Price money={line.unitPrice} {...(line.compareAt ? { compareAt: line.compareAt } : {})} size="sm" /></span> : null}
          </p>
        </div>
        {fail ? <p role="alert" className="text-sm text-danger">{t(`cart.errors.${fail.error}`, { n: fail.n })}</p> : null}
      </div>
    </li>
  )
}

/**
 * The lines of the cart: the same in the drawer and on the page. A removed line comes back with "Undo", which adds the same variant, quantity and customisation again.
 * @param {{ cart: import('@noor/contract').Cart, compact?: boolean, error?: string | undefined, n?: number | undefined }} props
 */
export function CartLines({ cart, compact, error, n }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const toast = useToast()
  const undo = useFetcher({ key: 'cart-undo' })

  /** @param {CartLine} line */
  const removed = (line) => {
    const customization = { ...line.customization }
    delete customization.summary
    toast.push({
      title: t('cart.removed', { title: line.title }),
      action: {
        label: t('cart.undo'),
        onClick: () => {
          void undo.submit(
            { intent: 'add', variantId: line.variantId, quantity: line.quantity, mode: 'fetch', ...(Object.keys(customization).length ? { customization: JSON.stringify(customization) } : {}) },
            { method: 'post', action: path('/cart') },
          )
        },
      },
    })
  }

  return (
    <div>
      {(error === 'insufficient_stock' || error === 'max_per_order') && n !== undefined ? <p role="alert" className="mb-2 text-danger">{t(`cart.errors.${error}`, { n })}</p> : null}
      <ul>
        {cart.lines.map((line) => <Line key={line.id} line={line} compact={compact ?? false} onRemoved={removed} />)}
      </ul>
    </div>
  )
}
