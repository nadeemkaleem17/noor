import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useFetcher, useLocation, useRevalidator } from 'react-router'
import { formatDate } from '@noor/i18n'
import { Button } from '@noor/ui/button'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { Link } from '@noor/ui/link'
import { Price } from '@noor/ui/price'
import { QuantityStepper } from '@noor/ui/quantity-stepper'
import { useHydrated } from '../catalog/filters'
import { Dot, percentOff } from '../catalog/product-card'
import { useLocalePath, useShell } from '../layout/use-shell'
import { useCartDrawer } from '../cart/cart-drawer'
import { WishlistButton } from '../wishlist/wishlist-button'
import { CustomSize } from './custom-size'
import { TrustPoints } from '../layout/trust-points'
import { DeliveryBlock } from './delivery-block'
import { OptionGroup } from './option-group'
import { SizeGuide } from './size-guide'
import { buttonState, initialChosen, isCustomSize, lowestPrice, maxQuantity, stockLine } from '~/lib/selection'

/** @typedef {import('~/lib/selection').ProductDetail} ProductDetail */
/** @typedef {import('~/lib/selection').Chosen} Chosen */

/** Tells the shop which of its out-of-stock sizes a visitor wants, by mobile number (the API keeps it for the back-in-stock message). Its own form, outside the add-to-cart one. @param {{ variantId: string, action: string, label: string }} props */
function NotifyMe({ variantId, action, label }) {
  const { t } = useTranslation('storefront')
  const fetcher = useFetcher()
  const d = fetcher.data
  return (
    <fetcher.Form method="post" action={action} className="flex flex-col gap-2 rounded-card border border-line-strong p-4">
      <input type="hidden" name="intent" value="notify" />
      <input type="hidden" name="variantId" value={variantId} />
      <p className="font-medium">{t('pdp.notify.title', { label })}</p>
      {d?.ok ? (
        <p role="status" className="text-success">{t('pdp.notify.done')}</p>
      ) : (
        <>
          <Field label={t('pdp.notify.phone')} {...(d && !d.ok ? { error: t('pdp.notify.failed') } : {})}>
            <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" required placeholder="03xx xxxxxxx" />
          </Field>
          <Button type="submit" variant="secondary" loading={fetcher.state !== 'idle'}>{t('pdp.notify.submit')}</Button>
        </>
      )}
    </fetcher.Form>
  )
}

/**
 * Everything beside the pictures (plan/06-storefront/04-pdp.md sections 4 to 8): brand, title, price for what is chosen, colourways, options, size help, stock, quantity and the
 * add-to-cart form. The form works without JavaScript (the options are radios; the server finds the variant); with it, nothing is sent but the variant, the quantity and what was attached
 * to the line, never a price. What the visitor chose is in this component only.
 * @param {object} props
 * @param {ProductDetail} props.product
 * @param {import('./size-guide').SizeChart | null} props.sizeChart
 * @param {import('./custom-size').FormSchema | null} props.formSchema
 * @param {string | undefined} props.whatsapp
 * @param {string} props.url
 * @param {string | undefined} props.cartError the reason a visitor without JavaScript was sent back
 * @param {number | undefined} props.cartErrorN
 * @param {string | null} props.sizeParam
 * @param {(valueId: string | undefined) => void} props.onFocusValue the picture to show for a chosen value
 */
export function BuyBox({ product: p, sizeChart, formSchema, whatsapp, url, cartError, cartErrorN, sizeParam, onFocusValue }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const shell = useShell()
  const location = useLocation()
  const hydrated = useHydrated()
  const fetcher = useFetcher()
  const revalidator = useRevalidator()
  const { setOpen: openCart } = useCartDrawer()
  const locale = shell?.locale ?? 'en'
  const display = shell?.config.priceDisplay

  const [chosen, setChosen] = useState(() => initialChosen(p.options, p.variants, sizeParam))
  /** @type {[Record<string, Chosen>, import('react').Dispatch<import('react').SetStateAction<Record<string, Chosen>>>]} */
  const [childChosen, setChildChosen] = useState({})
  const [qty, setQty] = useState(1)
  const [asked, setAsked] = useState(false)
  const groups = useRef(/** @type {Map<string, HTMLFieldSetElement | null>} */ (new Map()))
  const formId = useId()
  const mainButton = useRef(/** @type {HTMLButtonElement | null} */ (null))
  // the bar at the foot of a phone's screen shows once the real button has scrolled out of view
  const [buttonSeen, setButtonSeen] = useState(true)
  const ref = (/** @type {string} */ key) => (/** @type {HTMLFieldSetElement | null} */ el) => { groups.current.set(key, el) }

  const items = p.bundle?.items ?? []
  const own = buttonState(p.options, p.variants, chosen)
  const parts = items.map((item) => ({ item, state: buttonState(item.options, item.variants, childChosen[item.product.id] ?? {}) }))
  const waiting = own.state === 'select' ? { key: own.missing.id, name: own.missing.name } : (() => {
    const c = parts.find((x) => x.state.state === 'select')
    return c && c.state.state === 'select' ? { key: `${c.item.product.id}.${c.state.missing.id}`, name: t('pdp.bundle.sizeOf', { title: c.item.product.title }) } : undefined
  })()
  const variant = 'variant' in own ? own.variant : undefined
  const blockedChild = parts.some((x) => x.state.state === 'sold_out' || x.state.state === 'unavailable')
  const state = waiting ? 'select' : blockedChild ? 'sold_out' : own.state
  const stock = variant ? stockLine(variant) : undefined
  const custom = isCustomSize(p.options, chosen)

  const fail = fetcher.data && !fetcher.data.ok ? fetcher.data : undefined
  const done = fetcher.data?.ok === true
  const capped = fail?.error === 'insufficient_stock' && fail.variantId === variant?.id ? Number(fail.available) : undefined
  const max = Math.max(1, Math.min(variant ? maxQuantity(variant) : 99, capped || Infinity))
  const quantity = custom ? 1 : Math.min(qty, max)
  const pending = fetcher.state !== 'idle'

  useEffect(() => {
    const el = mainButton.current
    if (!el) return
    const watch = new IntersectionObserver(([entry]) => setButtonSeen(entry?.isIntersecting ?? true))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  // a line was added: the cart drawer shows it
  const added = fetcher.data
  useEffect(() => {
    if (added?.ok) openCart(true)
  }, [added, openCart])

  useEffect(() => {
    if (fail?.error === 'variant_unavailable') void revalidator.revalidate()
  }, [fail?.error, revalidator])

  /** @param {string} optionId @param {string} valueId */
  const choose = (optionId, valueId) => {
    setChosen((c) => ({ ...c, [optionId]: valueId }))
    onFocusValue(valueId)
  }

  const priced = variant ?? lowestPrice(p.variants).variant
  const from = !variant && lowestPrice(p.variants).varies
  const off = priced.compareAt && priced.compareAt.amount > priced.price.amount ? percentOff(priced.price, priced.compareAt) : undefined
  const toCart = path('/cart')
  const colour = p.siblings.length > 1 ? p.siblings : []
  const mto = p.madeToOrder
  const errorCode = fail?.error ?? cartError
  const errorN = fail ? (fail.available ?? fail.max) : cartErrorN
  /** Pressing "Select a size": the first choice still to make takes the focus, and the reason is said out loud. @param {import('react').MouseEvent} e */
  const press = (e) => {
    if (state !== 'select' || !hydrated) return
    e.preventDefault()
    setAsked(true)
    groups.current.get(waiting?.key ?? '')?.focus()
  }
  const label = {
    add: t('pdp.button.add'), select: t('pdp.button.select', { name: waiting?.name ?? '' }), sold_out: t('pdp.button.soldOut'), preorder: t('pdp.button.preorder'),
    order: t('pdp.button.order'), unavailable: t('pdp.button.unavailable'),
  }[state]

  return (
    <div className="flex flex-col gap-5">
      <div>
        {p.brand ? <p className="text-sm font-medium uppercase tracking-wide text-fg-soft">{p.brand}</p> : null}
        <h1 className="font-heading text-h1">{p.title}</h1>
        {p.subtitle ? <p className="mt-1 text-fg-soft">{p.subtitle}</p> : null}
        {p.rating ? (
          <p className="mt-2 text-sm">
            <a href="#reviews" className="underline underline-offset-4">{t('pdp.rating', { average: p.rating.average.toFixed(1), count: p.rating.count })}</a>
          </p>
        ) : null}
      </div>

      <div>
        <p className="flex flex-wrap items-baseline gap-x-2">
          {from ? <span className="text-fg-soft">{t('product.from')}</span> : null}
          <Price money={priced.price} {...(priced.compareAt ? { compareAt: priced.compareAt } : {})} size="lg" display={display} />
          {off ? <span className="rounded-control bg-sale px-2 py-0.5 text-sm font-medium text-on-accent">{t('product.badge.sale', { percent: off })}</span> : null}
        </p>
        <p className="mt-1 text-sm text-muted">{t('pdp.taxNote')}</p>
      </div>

      {colour.length ? (
        <div>
          <p className="mb-2 text-sm font-medium">{t('pdp.colour', { name: p.colorway?.label ?? '' })}</p>
          <ul className="flex flex-wrap gap-2">
            {colour.map((s) => (
              <li key={s.handle}>
                <RouterLink to={path(`/p/${s.handle}`)} aria-label={t('product.colour', { name: s.label })} aria-current={s.current ? 'true' : undefined} className={`grid size-10 place-items-center rounded-full border-2 ${s.current ? 'border-accent' : 'border-transparent'}`}>
                  <Dot swatch={s.swatch} />
                </RouterLink>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <fetcher.Form id={formId} method="post" action={toCart} className="flex flex-col gap-5">
        <input type="hidden" name="intent" value="add" />
        <input type="hidden" name="handle" value={p.handle} />
        <input type="hidden" name="returnTo" value={location.pathname} />
        {hydrated ? <input type="hidden" name="mode" value="fetch" /> : null}
        {hydrated && variant ? <input type="hidden" name="variantId" value={variant.id} /> : null}

        {p.options.map((o) => (
          <div key={o.id} className="flex flex-col gap-2">
            <OptionGroup option={o} variants={p.variants} chosen={chosen} onChoose={choose} groupRef={ref(o.id)} />
            {o.role === 'size' && (sizeChart || p.fit) ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                {sizeChart ? <SizeGuide chart={sizeChart} /> : <span />}
                {p.fit?.note ? <span className="text-fg-soft">{t(`pdp.fit.${p.fit.note}`)}</span> : null}
              </div>
            ) : null}
            {o.role === 'size' && p.fit?.modelHeightCm ? (
              <p className="text-sm text-fg-soft">{p.fit.modelWears ? t('pdp.model', { height: p.fit.modelHeightCm, size: p.fit.modelWears }) : t('pdp.modelHeight', { height: p.fit.modelHeightCm })}</p>
            ) : null}
          </div>
        ))}

        {custom && formSchema ? <CustomSize schema={formSchema} errors={errorCode === 'invalid'} /> : null}

        {items.length ? (
          <div className="flex flex-col gap-4 rounded-card border border-line-strong p-4">
            <p className="font-medium">{t('pdp.bundle.title')}</p>
            {parts.map(({ item }) => {
              const picked = buttonState(item.options, item.variants, childChosen[item.product.id] ?? {})
              return (
                <div key={item.product.id} className="flex flex-col gap-2">
                  <p className="text-sm">{item.product.title}</p>
                  {item.options.map((o) => (
                    <OptionGroup key={o.id} option={o} variants={item.variants} chosen={childChosen[item.product.id] ?? {}} name={`bundle-${item.product.id}`} groupRef={ref(`${item.product.id}.${o.id}`)} onChoose={(optionId, valueId) => setChildChosen((c) => ({ ...c, [item.product.id]: { ...c[item.product.id], [optionId]: valueId } }))} />
                  ))}
                  {hydrated && 'variant' in picked ? <input type="hidden" name={`bundle.${item.product.id}`} value={picked.variant.id} /> : null}
                </div>
              )
            })}
          </div>
        ) : null}

        <div aria-live="polite" className="min-h-6">
          {state === 'select' ? null : stock ? (
            <p className={stock.kind === 'low' ? 'text-warning' : stock.kind === 'sold_out' ? 'text-danger' : 'text-fg-soft'}>
              {stock.kind === 'in_stock' ? t('pdp.stock.in_stock')
                : stock.kind === 'low' ? (stock.n !== undefined ? t('pdp.stock.low', { n: stock.n }) : t('pdp.stock.lowUnknown'))
                : stock.kind === 'sold_out' ? t('pdp.stock.sold_out')
                : stock.kind === 'preorder' ? (stock.date ? t('pdp.stock.preorder', { date: formatDate(stock.date, locale) }) : t('pdp.stock.preorderUnknown'))
                : mto?.label ?? t('pdp.stock.madeToOrder')}
            </p>
          ) : null}
        </div>

        {custom || state === 'sold_out' || state === 'unavailable' ? null : (
          <div className="flex items-center gap-3">
            {hydrated ? (
              <>
                <QuantityStepper value={quantity} onValueChange={setQty} min={1} max={max} label={t('pdp.quantity')} maxMessage={t('pdp.maxQuantity', { n: max })} />
                <input type="hidden" name="quantity" value={quantity} />
              </>
            ) : (
              <label className="flex items-center gap-2 text-sm">
                {t('pdp.quantity')}
                <input type="number" name="quantity" min={1} max={99} defaultValue={1} className="h-11 w-20 rounded-control border border-line-strong bg-surface px-3" />
              </label>
            )}
          </div>
        )}
        {custom ? <input type="hidden" name="quantity" value="1" /> : null}

        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={pending}
            disabled={state === 'sold_out' || state === 'unavailable'}
            ref={mainButton}
            onClick={press}
          >
            {label}
          </Button>
          {state === 'select' && asked ? <p role="alert" className="text-sm text-danger">{t('pdp.errors.select', { name: waiting?.name ?? '' })}</p> : null}
          {errorCode ? <p role="alert" className="text-sm text-danger">{t(`pdp.errors.${errorCode}`, { n: errorN })}</p> : null}
          {done ? (
            <p role="status" className="text-sm text-success">
              {t('pdp.added')} <RouterLink to={toCart} className="underline underline-offset-4">{t('pdp.viewCart')}</RouterLink>
            </p>
          ) : null}
        </div>
      </fetcher.Form>

      {hydrated && !buttonSeen ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-line bg-bg p-3 lg:hidden">
          <Price money={priced.price} {...(priced.compareAt ? { compareAt: priced.compareAt } : {})} size="lg" display={display} />
          <Button type="submit" form={formId} loading={pending} disabled={state === 'sold_out' || state === 'unavailable'} onClick={press}>{label}</Button>
        </div>
      ) : null}

      {state === 'sold_out' && variant && shell?.config.features.notifyMe ? (
        <NotifyMe variantId={variant.id} action={path(`/p/${p.handle}`)} label={p.options.map((o) => o.values.find((v) => v.id === chosen[o.id])?.label).filter(Boolean).join(' / ')} />
      ) : null}

      <DeliveryBlock delivery={p.delivery} mto={mto} />
      <TrustPoints whatsappHref={whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(t('pdp.whatsappText', { title: p.title, url }))}` : undefined} />
      <ul className="flex flex-col gap-2 text-sm text-fg-soft">
        <li><WishlistButton product={p} text /></li>
        {whatsapp ? (
          <li>
            <Link href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(t('pdp.whatsappText', { title: p.title, url }))}`} className="underline underline-offset-4">{t('pdp.whatsapp')}</Link>
          </li>
        ) : null}
        <li>
          <Link href={`https://wa.me/?text=${encodeURIComponent(`${p.title} ${url}`)}`} className="underline underline-offset-4">{t('pdp.share')}</Link>
        </li>
      </ul>
    </div>
  )
}
