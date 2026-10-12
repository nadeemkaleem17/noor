import { PkMobile } from '@noor/contract'
import { formatMoney } from '@noor/i18n/format'
import { Button } from '@noor/ui/button'
import { Card } from '@noor/ui/card'
import { Checkbox } from '@noor/ui/checkbox'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { Textarea } from '@noor/ui/textarea'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AppLink } from '@/components/app-link'
import { PageHeader } from '@/components/page-header'
import { api } from '@/lib/api'
import { useDebounced } from '@/lib/use-debounced'
import { useCan } from '@/lib/session'
import { customerByPhoneQuery, customerDetailQuery, orderLookupsQuery } from '@/lib/sales'
import { humanise, orderMessage } from '../labels'
import { VariantPicker } from '@/components/variant-picker'

/** @typedef {import('@/components/variant-picker').OrderLine} OrderLine */

const rupees = (/** @type {{ amount: number; currency: 'PKR' }} */ m) => formatMoney(m, 'en')

/** @param {{ title: string; children: import('react').ReactNode }} props */
function Step({ title, children }) {
  return (
    <Card render={<section aria-label={title} />} className="space-y-3">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      {children}
    </Card>
  )
}

/**
 * `/orders/new` (plan/07-admin/06-customers.md section 4): an order taken by phone or WhatsApp. It is priced, stock-reserved and checked for the promo code by the server exactly like a
 * website order; there is no field for a price or a discount. `?customer=<id>` starts from a customer already on file.
 */
export function OrderNew() {
  const can = useCan()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const customerId = search.get('customer') ?? ''
  const known = useQuery({ ...customerDetailQuery(customerId), enabled: customerId !== '' && can('customers:read') })
  const lookups = useQuery(orderLookupsQuery)

  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [lines, setLines] = useState(/** @type {OrderLine[]} */ ([]))
  const [cityId, setCityId] = useState('')
  const [address, setAddress] = useState('')
  const [landmark, setLandmark] = useState('')
  const [notes, setNotes] = useState('')
  const [methodId, setMethodId] = useState('')
  const [payment, setPayment] = useState('')
  const [promo, setPromo] = useState('')
  const [confirmedOnCall, setConfirmedOnCall] = useState(false)
  const [note, setNote] = useState('')

  // a customer on file fills the name and number once (the person may still change them)
  const [filled, setFilled] = useState('')
  if (known.data && filled !== known.data.id) {
    setFilled(known.data.id)
    setPhone(known.data.phone.replace(/^\+92/, '0'))
    setName(known.data.name)
    if (known.data.email) setEmail(known.data.email)
  }

  const phoneParsed = PkMobile.safeParse(phone)
  const phoneOk = phoneParsed.success && /^\+92\d{10}$/.test(phoneParsed.data)
  const typedPhone = useDebounced(phoneOk ? phoneParsed.data : '', 400)
  const existing = useQuery({ ...customerByPhoneQuery(typedPhone), enabled: typedPhone !== '' && customerId === '' })
  const match = existing.data?.customer

  const quoteBody = {
    lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, ...(l.customization ? { customization: l.customization } : {}) })),
    cityId,
    ...(methodId ? { shippingMethodId: methodId } : {}),
    ...(payment ? { paymentMethod: payment } : {}),
    ...(promo.trim() ? { promoCode: promo.trim() } : {}),
    ...(typedPhone ? { phone: typedPhone } : {}),
  }
  const quoteKey = JSON.stringify(quoteBody)
  const quote = useQuery({
    queryKey: ['orders', 'quote', quoteKey],
    queryFn: ({ signal }) => api('admin.orders.quote', { body: /** @type {never} */ (JSON.parse(quoteKey)), signal }),
    enabled: lines.length > 0 && cityId !== '',
    retry: false,
    placeholderData: (previous) => previous,
  })
  const cart = quote.data
  const methods = cart?.shippingOptions ?? []
  const effectiveMethod = methodId || cart?.shipping?.methodId || ''
  const payments = (cart?.paymentOptions ?? []).filter((o) => o.allowed)
  const effectivePayment = payment || payments[0]?.method || ''

  // one key per distinct order, so a double click creates it once and a changed order is a new one
  const body = {
    customer: { name: name.trim(), phone: typedPhone || (phoneOk ? phoneParsed.data : ''), ...(email.trim() ? { email: email.trim() } : {}) },
    shippingAddress: { cityId, address: address.trim(), ...(landmark.trim() ? { landmark: landmark.trim() } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) },
    shippingMethodId: effectiveMethod,
    paymentMethod: effectivePayment,
    lines: quoteBody.lines,
    ...(promo.trim() ? { promoCode: promo.trim() } : {}),
    ...(confirmedOnCall ? { confirmedOnCall: true } : {}),
    ...(note.trim() ? { note: note.trim() } : {}),
  }
  const bodyJson = JSON.stringify(body)
  const [attempt, setAttempt] = useState({ json: '', key: '' })
  const key = attempt.json === bodyJson ? attempt.key : crypto.randomUUID()
  const create = useMutation({
    mutationFn: () => {
      setAttempt({ json: bodyJson, key })
      return api('admin.orders.create', { body: /** @type {never} */ (JSON.parse(bodyJson)), idempotencyKey: key })
    },
    onSuccess: (order) => void navigate(`/orders/${order.id}`),
  })
  const ready = lines.length > 0 && name.trim().length >= 2 && phoneOk && cityId !== '' && address.trim().length >= 10 && effectiveMethod !== '' && effectivePayment !== '' && quote.isSuccess && !quote.isFetching && !cart?.hasBlockingIssues

  return (
    <>
      <PageHeader title="New order" description="For an order taken by phone or WhatsApp. Prices and stock come from the server, as on the website." actions={<AppLink to="/orders">Cancel</AppLink>} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Step title="Customer">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mobile number" required error={phone && !phoneOk ? 'Enter a Pakistani mobile number, like 0300 1234567.' : undefined}>
                <Input type="tel" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Field label="Name" required>
                <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Email">
                <Input type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            </div>
            {match ? (
              <p className="text-sm">
                A customer with this number is on file: <strong>{match.name}</strong> ({match.ordersCount === 1 ? '1 order' : `${match.ordersCount} orders`}).{' '}
                {name.trim() !== match.name ? (
                  <Button variant="link" onClick={() => setName(match.name)}>
                    Use this name
                  </Button>
                ) : null}
                {match.noCod ? <strong className="ms-1 text-danger">No cash on delivery for this number.</strong> : null}
              </p>
            ) : null}
          </Step>

          <Step title="Items">
            {lines.length ? (
              <ul className="divide-y divide-line text-sm">
                {lines.map((l, i) => {
                  const priced = cart?.lines.find((x) => x.variantId === l.variantId)
                  return (
                    <li key={`${l.variantId}-${i}`} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0">
                        {l.title}
                        <span className="block text-xs text-muted">
                          {l.label || 'Standard'} · {l.sku} · × {l.quantity}
                          {l.customization?.measurements ? ' · made to measure' : ''}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {priced ? <span className="tabular-nums">{rupees(priced.lineSubtotal)}</span> : null}
                        <Button size="sm" variant="ghost" aria-label={`Remove ${l.title}`} iconStart={<Trash2 aria-hidden className="size-4" />} onClick={() => setLines((all) => all.filter((_, j) => j !== i))} />
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">No items yet.</p>
            )}
            <VariantPicker onAdd={(line) => setLines((all) => [...all, line])} />
          </Step>

          <Step title="Delivery and payment">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="City" required>
                <NativeSelect options={[{ value: '', label: 'Choose a city' }, ...(lookups.data?.cities ?? []).map((c) => ({ value: c.id, label: c.name }))]} value={cityId} onChange={(e) => (setCityId(e.target.value), setMethodId(''))} />
              </Field>
              <Field label="Delivery method" required>
                <NativeSelect
                  options={[{ value: '', label: methods.length ? 'Choose a method' : 'Choose a city and add items' }, ...methods.map((m) => ({ value: m.methodId, label: `${m.label} · ${rupees(m.fee)}${m.codAllowed ? '' : ' · no COD'}` }))]}
                  value={effectiveMethod}
                  onChange={(e) => setMethodId(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Address" required error={address && address.trim().length < 10 ? 'Give the full address (at least 10 characters).' : undefined}>
              <Textarea rows={2} value={address} maxLength={250} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Landmark">
                <Input value={landmark} maxLength={120} onChange={(e) => setLandmark(e.target.value)} />
              </Field>
              <Field label="Notes for the rider">
                <Input value={notes} maxLength={250} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
            <Field label="Payment" required>
              <NativeSelect
                options={(cart?.paymentOptions ?? []).map((o) => ({ value: o.method, label: o.allowed ? o.label : `${o.label} (not available${o.reason ? `: ${humanise(o.reason)}` : ''})`, disabled: !o.allowed }))}
                value={effectivePayment}
                onChange={(e) => setPayment(e.target.value)}
              />
            </Field>
          </Step>
        </div>

        <div className="space-y-4">
          <Step title="Summary">
            {cart ? (
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{rupees(cart.subtotal)}</dd></div>
                {cart.discount.amount > 0 ? <div className="flex justify-between"><dt className="text-muted">Discount{cart.promo ? ` (${cart.promo.code})` : ''}</dt><dd className="tabular-nums">−{rupees(cart.discount)}</dd></div> : null}
                {cart.shipping ? <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd className="tabular-nums">{rupees(cart.shipping.fee)}</dd></div> : null}
                <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{rupees(cart.total)}</dd></div>
                {cart.depositDue && cart.depositDue.amount > 0 ? <div className="flex justify-between"><dt className="text-muted">Deposit due</dt><dd className="tabular-nums">{rupees(cart.depositDue)}</dd></div> : null}
              </dl>
            ) : (
              <p className="text-sm text-muted">Add items and choose a city to see the total.</p>
            )}
            {cart?.promoProblem ? <p className="text-sm text-warning">The promo code does not apply: {humanise(cart.promoProblem)}.</p> : null}
            {cart?.hasBlockingIssues ? <p role="alert" className="text-sm text-danger">An item is sold out or unavailable. Remove it to go on.</p> : null}
            {quote.error ? <p role="alert" className="text-sm text-danger">{orderMessage(quote.error)}</p> : null}
            <Field label="Promo code" hint="A manual discount is a promo code made for the purpose.">
              <Input value={promo} maxLength={20} onChange={(e) => setPromo(e.target.value.toUpperCase())} />
            </Field>
            <Checkbox label="The customer confirmed on this call" checked={confirmedOnCall} onCheckedChange={setConfirmedOnCall} />
            <Field label="Note for the team">
              <Input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
            </Field>
            {create.error ? <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">{orderMessage(create.error)}</p> : null}
            <Button fullWidth size="md" loading={create.isPending} disabled={!ready} onClick={() => create.mutate()}>
              Create order
            </Button>
          </Step>
        </div>
      </div>
    </>
  )
}
