import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Form, Link as RouterLink, useFetcher, useNavigation } from 'react-router'
import { formatMoney } from '@noor/i18n'
import { Button } from '@noor/ui/button'
import { ErrorState } from '@noor/ui/error-state'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { Link } from '@noor/ui/link'
import { NativeSelect } from '@noor/ui/native-select'
import { Textarea } from '@noor/ui/textarea'
import { useHydrated } from '../catalog/filters'
import { ShopPrice as Price } from '../catalog/shop-price'
import { useLocalePath, useShell } from '../layout/use-shell'
import { draftFields, forgetCheckout, recallDraft, recallKey, rememberDraft, rememberKey } from './memory'
import { OrderSummary } from './order-summary'

/** @typedef {import('@noor/contract').Cart} Cart */

/** What changed under the customer's feet, line by line, from the cart the API sent back with its refusal (section 4.4). @param {{ cart: Cart, reason?: string | undefined }} props */
function Changes({ cart, reason }) {
  const { t } = useTranslation('storefront')
  const shell = useShell()
  const money = (/** @type {import('@noor/contract').Money} */ m) => formatMoney(m, shell?.locale ?? 'en', shell?.config.priceDisplay)
  const notes = cart.lines.flatMap((l) =>
    l.issues.map((i) => (i === 'price_changed' ? t('checkout.changed.price', { title: l.title, amount: money(l.unitPrice) }) : i === 'low_stock' ? t('checkout.changed.low', { title: l.title, n: l.available ?? 0 }) : t(`checkout.changed.${i}`, { title: l.title }))),
  )
  if (cart.promoProblem) notes.push(cart.promoProblem)
  return (
    <div role="alert" className="rounded-card bg-danger-soft p-4">
      <p className="font-medium">{t('checkout.changed.title')}</p>
      {notes.length ? <ul className="mt-1 list-disc ps-5 text-sm">{notes.map((n) => <li key={n}>{n}</li>)}</ul> : <p className="text-sm">{reason ?? t('checkout.changed.total')}</p>}
      <p className="mt-1 text-sm">{t('checkout.changed.again')}</p>
    </div>
  )
}

/** The failures that are not about one field. @param {{ error: string, reason?: string | undefined, whatsapp: string | undefined }} props */
function Failure({ error, reason, whatsapp }) {
  const { t } = useTranslation('storefront')
  const text = t(`checkout.errors.${error}`, { defaultValue: t('checkout.errors.unavailable') })
  return (
    <div role="alert" className="rounded-card bg-danger-soft p-4 text-sm">
      <p>{text}{reason === 'cod_limit_exceeded' ? ` ${t('checkout.errors.codLimit')}` : ''}</p>
      {error === 'city' && whatsapp ? <p className="mt-1"><Link href={`https://wa.me/${whatsapp}`} className="underline underline-offset-4">{t('checkout.whatsapp')}</Link></p> : null}
    </div>
  )
}

/**
 * Guest checkout on one page (plan/06-storefront/05-cart-checkout.md section 4). It is an ordinary form: without JavaScript "Update delivery options" asks the server for the quote of
 * the chosen city and "Place order" sends it. With JavaScript, choosing a city or a delivery method asks for the quote by itself, the typed fields are kept for a refresh, and the
 * idempotency key of this checkout survives a reload, so a retry after a lost answer is the same order.
 * @param {object} props
 * @param {{ cart: Cart, cities: { id: string, name: string, province: string, isMajor: boolean }[], key: string, sig: string, extraFields: import('@noor/contract').FormField[], marketing: { enabled: boolean, label: string }, payments: { type: string, label: string, description?: string | undefined }[], whatsapp: string | undefined }} props.loader
 * @param {{ values?: Record<string, string>, cart?: Cart, result?: any } | undefined} props.action what the last post answered
 */
export function CheckoutForm({ loader, action }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const shell = useShell()
  const hydrated = useHydrated()
  const navigation = useNavigation()
  const quoteFetcher = useFetcher()
  const form = useRef(/** @type {HTMLFormElement | null} */ (null))
  // what the form held at the newest answer: the last quote the browser asked for, else the last post
  const values = quoteFetcher.data?.values ?? action?.values ?? {}
  const result = action?.result
  const placing = navigation.state !== 'idle' && navigation.formData?.get('intent') === 'place'
  const quoting = quoteFetcher.state !== 'idle'
  // the newest answer wins: a quote the browser asked for, then the last post, then the page as it loaded
  const cart = /** @type {Cart} */ (quoteFetcher.data?.cart ?? action?.cart ?? loader.cart)
  const key = values.idempotencyKey ?? loader.key
  const fields = result?.error === 'fields' ? /** @type {Record<string, string>} */ (result.fields) : {}
  const fail = (/** @type {string} */ name) => (fields[name] ? t(`checkout.fieldErrors.${name.replace(/\./g, '_')}`, { defaultValue: t('checkout.fieldErrors.invalid') }) : undefined)

  // the order is placed and the visitor is on their way to its page: the next checkout starts clean
  const leaving = navigation.state === 'loading' && navigation.formData?.get('intent') === 'place' && !navigation.location.pathname.endsWith('/checkout')
  useEffect(() => {
    if (leaving) forgetCheckout()
  }, [leaving])

  // this checkout's key and the typed fields, from this tab's memory (client only; nothing here changes what the server sent)
  useEffect(() => {
    const f = form.current
    if (!f) return
    const hidden = /** @type {HTMLInputElement} */ (f.elements.namedItem('idempotencyKey'))
    const stored = recallKey(loader.sig)
    if (stored && !action?.values?.idempotencyKey) hidden.value = stored
    else rememberKey(hidden.value, loader.sig)
    const draft = recallDraft()
    for (const name of draftFields) {
      const el = /** @type {HTMLInputElement | null} */ (f.elements.namedItem(name))
      if (el && !el.value && draft[name]) el.value = draft[name]
    }
  }, [loader.sig, action?.values?.idempotencyKey])

  // a refusal that leaves the page where it is: the first thing to fix takes the focus. The form is inert while the order is on its way (also while the router reloads after the answer), and
  // an inert field cannot take the focus, so this waits for the form to be live again and runs once per answer
  const handled = useRef(/** @type {unknown} */ (undefined))
  useEffect(() => {
    if (!result || result.ok || placing || handled.current === result) return
    handled.current = result
    const first = form.current?.querySelector('[aria-invalid="true"], [role="alert"]')
    first?.scrollIntoView({ block: 'center' })
    // a field takes the focus (its error is read with it, through aria-describedby); a message that is not a field is only scrolled to, its alert is read anyway
    if (first instanceof HTMLElement && first.matches('input, select, textarea')) first.focus({ preventScroll: true })
  }, [result, placing])

  /** @param {HTMLFormElement} f @param {string} intent */
  const quote = (f, intent = 'quote') => {
    const data = new FormData(f)
    data.set('intent', intent)
    data.set('mode', 'fetch')
    void quoteFetcher.submit(data, { method: 'post', action: path('/checkout') })
  }

  const methods = cart.shippingOptions ?? []
  const pickedMethod = values.shippingMethodId && methods.some((m) => m.methodId === values.shippingMethodId) ? values.shippingMethodId : cart.shipping?.methodId
  const options = cart.paymentOptions ?? loader.payments.map((p) => ({ method: p.type, label: p.label, ...(p.description ? { description: p.description } : {}), allowed: true }))
  const pickedPayment = values.paymentMethod && options.some((o) => o.method === values.paymentMethod && o.allowed) ? values.paymentMethod : (options.find((o) => o.method === 'cod' && o.allowed) ?? options.find((o) => o.allowed))?.method
  const cityId = values.cityId ?? ''
  const noMethod = Boolean(cityId) && !quoting && methods.length === 0 && !cart.shipping

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        <h1 className="font-heading text-h1">{t('checkout.title')}</h1>
        <details className="mt-4 rounded-card border border-line p-4 lg:hidden">
          <summary className="flex cursor-pointer items-center justify-between font-medium">
            {t('checkout.summary')}
            <Price money={cart.total} />
          </summary>
          <div className="mt-3"><OrderSummary cart={cart} pending={quoting} /></div>
        </details>

        <Form
          ref={form}
          method="post"
          action={path('/checkout')}
          inert={placing}
          noValidate={hydrated}
          className="mt-6 flex flex-col gap-8"
          onBlur={(e) => {
            const f = e.currentTarget
            /** @type {Record<string, string>} */
            const draft = {}
            for (const name of draftFields) draft[name] = /** @type {HTMLInputElement | null} */ (f.elements.namedItem(name))?.value ?? ''
            rememberDraft(draft)
          }}
        >
          {Object.keys(fields).length > 0 ? <p role="status" className="sr-only">{t('checkout.errors.needAttention', { count: Object.keys(fields).length })}</p> : null}
          {/* Enter in a field must place the order, not ask for the delivery options */}
          <button type="submit" name="intent" value="place" tabIndex={-1} aria-hidden="true" className="sr-only" />
          <input key={key} type="hidden" name="idempotencyKey" defaultValue={key} />
          <input type="hidden" name="expectedTotal" value={cart.total.amount} />

          {result?.error === 'changed' ? <Changes cart={result.cart} reason={result.reason} /> : null}
          {result && ['busy', 'unavailable', 'failed', 'empty', 'payment'].includes(result.error) ? <Failure error={result.error} reason={result.reason} whatsapp={loader.whatsapp} /> : null}

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 font-heading text-h3">{t('checkout.contact')}</legend>
            <Field label={t('checkout.name')} required {...(fail('customer.name') ? { error: fail('customer.name') } : {})}>
              <Input name="name" required minLength={2} maxLength={80} autoComplete="name" defaultValue={values.name ?? ''} invalid={Boolean(fail('customer.name'))} />
            </Field>
            <Field label={t('checkout.phone')} required hint={t('checkout.phoneHint')} {...(fail('customer.phone') ? { error: fail('customer.phone') } : {})}>
              <Input name="phone" type="tel" inputMode="tel" dir="ltr" required autoComplete="tel" placeholder="03xx xxxxxxx" defaultValue={values.phone ?? ''} invalid={Boolean(fail('customer.phone'))} />
            </Field>
            <Field label={t('checkout.email')} hint={t('checkout.emailHint')} {...(fail('customer.email') ? { error: fail('customer.email') } : {})}>
              <Input name="email" type="email" inputMode="email" dir="ltr" maxLength={254} autoComplete="email" defaultValue={values.email ?? ''} invalid={Boolean(fail('customer.email'))} />
            </Field>
          </fieldset>

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 font-heading text-h3">{t('checkout.delivery')}</legend>
            <Field label={t('checkout.city')} required {...(fail('shippingAddress.cityId') || result?.error === 'city' ? { error: fail('shippingAddress.cityId') ?? t('checkout.errors.city') } : {})}>
              <NativeSelect
                name="cityId"
                required
                placeholder={t('checkout.cityChoose')}
                defaultValue={cityId}
                options={loader.cities.map((c) => ({ value: c.id, label: c.name }))}
                onChange={(e) => { const f = e.currentTarget.form; if (hydrated && f) quote(f) }}
              />
            </Field>
            {!hydrated ? <Button type="submit" name="intent" value="quote" variant="secondary" formNoValidate>{t('checkout.updateDelivery')}</Button> : null}
            <Field label={t('checkout.address')} required hint={t('checkout.addressHint')} {...(fail('shippingAddress.address') ? { error: fail('shippingAddress.address') } : {})}>
              <Textarea name="address" required minLength={10} maxLength={250} autoComplete="street-address" rows={2} defaultValue={values.address ?? ''} invalid={Boolean(fail('shippingAddress.address'))} />
            </Field>
            <Field label={t('checkout.landmark')}>
              <Input name="landmark" maxLength={120} defaultValue={values.landmark ?? ''} />
            </Field>
            <Field label={t('checkout.notes')}>
              <Input name="notes" maxLength={250} defaultValue={values.notes ?? ''} />
            </Field>
            {loader.extraFields.map((f) => (
              <Field key={f.key} label={f.label} required={f.required} {...(f.helpText ? { hint: f.helpText } : {})} {...(fail(`customFields.${f.key}`) ? { error: fail(`customFields.${f.key}`) } : {})}>
                {f.type === 'select' ? (
                  <NativeSelect name={`cf.${f.key}`} required={f.required} placeholder={t('checkout.choose')} defaultValue={values[`cf.${f.key}`] ?? ''} options={f.options ?? []} />
                ) : f.type === 'textarea' ? (
                  <Textarea name={`cf.${f.key}`} required={f.required} defaultValue={values[`cf.${f.key}`] ?? ''} />
                ) : f.type === 'checkbox' ? (
                  <input type="checkbox" name={`cf.${f.key}`} defaultChecked={values[`cf.${f.key}`] === 'on'} className="size-5 accent-accent" />
                ) : (
                  <Input name={`cf.${f.key}`} required={f.required} type={f.type === 'number' ? 'number' : f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : 'text'} defaultValue={values[`cf.${f.key}`] ?? ''} />
                )}
              </Field>
            ))}

            {cityId ? (
              <fieldset key={`${cityId}-${pickedMethod}-${methods.length}`} className="flex flex-col gap-2" aria-busy={quoting}>
                <legend className="mb-1 font-medium">{t('checkout.method')}</legend>
                {noMethod ? <p role="alert" className="text-sm text-danger">{t('checkout.errors.city')}{loader.whatsapp ? <> <Link href={`https://wa.me/${loader.whatsapp}`} className="underline underline-offset-4">{t('checkout.whatsapp')}</Link></> : null}</p> : null}
                {methods.map((m) => (
                  <label key={m.methodId} className="flex items-center gap-3 rounded-control border border-line-strong p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                    <input type="radio" name="shippingMethodId" value={m.methodId} required defaultChecked={m.methodId === pickedMethod} onChange={(e) => { const f = e.currentTarget.form; if (hydrated && f) quote(f) }} className="size-4 accent-accent" />
                    <span className="flex-1">{m.label} <span className="text-sm text-fg-soft">{t('checkout.eta', { min: m.etaMinDays, max: m.etaMaxDays })}</span></span>
                    {m.fee.amount === 0 ? <span>{t('cart.free')}</span> : <Price money={m.fee} />}
                  </label>
                ))}
              </fieldset>
            ) : (
              <p className="text-sm text-fg-soft">{t('checkout.chooseCityFirst')}</p>
            )}
            {fail('shippingMethodId') ? <p role="alert" aria-invalid="true" className="text-sm text-danger">{fail('shippingMethodId')}</p> : null}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-heading text-h3">{t('checkout.payment')}</legend>
            {fail('paymentMethod') ? <p role="alert" aria-invalid="true" className="text-sm text-danger">{fail('paymentMethod')}</p> : null}
            {options.some((o) => o.allowed) ? (
              options.map((o) => (
                <label key={o.method} className={`flex items-start gap-3 rounded-control border border-line-strong p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft ${o.allowed ? '' : 'opacity-60'}`}>
                  <input type="radio" name="paymentMethod" value={o.method} disabled={!o.allowed} defaultChecked={o.method === pickedPayment} required className="mt-1 size-4 accent-accent" />
                  <span>
                    <span className="block font-medium">{o.label}</span>
                    <span className="block text-sm text-fg-soft">{o.allowed ? (o.description ?? t(`checkout.paymentNote.${o.method}`, { defaultValue: '' })) : t(`checkout.notAllowed.${o.reason ?? 'other'}`, { defaultValue: t('checkout.notAllowed.other') })}</span>
                  </span>
                </label>
              ))
            ) : (
              <ErrorState title={t('checkout.noPayment')} body={loader.whatsapp ? <Link href={`https://wa.me/${loader.whatsapp}`} className="underline underline-offset-4">{t('checkout.whatsapp')}</Link> : undefined} />
            )}
            {cart.depositDue ? (
              <p className="text-sm text-fg-soft">
                {t('checkout.deposit', { now: formatMoney(cart.depositDue, shell?.locale ?? 'en', shell?.config.priceDisplay), later: cart.dueOnDelivery ? formatMoney(cart.dueOnDelivery, shell?.locale ?? 'en', shell?.config.priceDisplay) : '' })}
                {' '}{pickedPayment === 'cod' ? t('checkout.depositCod') : ''}
              </p>
            ) : null}
            <p className="text-sm text-fg-soft">{pickedPayment === 'cod' ? t('checkout.codNote') : ''}</p>
          </fieldset>

          {loader.marketing.enabled ? (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="marketingConsent" defaultChecked={values.marketingConsent === 'on'} className="mt-0.5 size-4 accent-accent" />
              {loader.marketing.label}
            </label>
          ) : null}

          <div className="flex flex-col gap-3">
            {/* the total beside the button, so it is in view when the order is placed (the summary is folded away on a phone) */}
            <p className="flex items-baseline justify-between font-medium lg:hidden">
              <span>{t('cart.total')}</span>
              <Price money={cart.total} size="lg" />
            </p>
            <p className="text-center text-small text-fg-soft">{t('checkout.trustLine')}</p>
            <Button type="submit" name="intent" value="place" size="lg" fullWidth loading={placing} disabled={!options.some((o) => o.allowed)}>{t('checkout.place')}</Button>
            <p className="text-center text-sm text-fg-soft">
              {t('checkout.terms')}{' '}
              <RouterLink to={path('/pages/terms')} className="underline underline-offset-4">{t('checkout.termsLink')}</RouterLink>{' · '}
              <RouterLink to={path('/pages/shipping-returns')} className="underline underline-offset-4">{t('checkout.returnsLink')}</RouterLink>
            </p>
          </div>
        </Form>
      </div>
      <aside aria-label={t('checkout.summary')} className="hidden lg:block">
        <div className="sticky top-6 rounded-card border border-line p-4">
          <h2 className="mb-3 font-heading text-h3">{t('checkout.summary')}</h2>
          <OrderSummary cart={cart} pending={quoting} />
        </div>
      </aside>
    </div>
  )
}
