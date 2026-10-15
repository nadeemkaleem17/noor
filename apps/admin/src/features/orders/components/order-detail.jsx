import { formatMoney } from '@noor/i18n/format'
import { Badge, StatusBadge } from '@noor/ui/badge'
import { Button, IconButton, LinkButton } from '@noor/ui/button'
import { Card } from '@noor/ui/card'
import { ErrorState } from '@noor/ui/error-state'
import { Link } from '@noor/ui/link'
import { Menu } from '@noor/ui/menu'
import { Skeleton } from '@noor/ui/skeleton'
import { Tooltip } from '@noor/ui/tooltip'
import { Textarea } from '@noor/ui/textarea'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronDown, Copy, MessageCircle, Phone, Printer } from 'lucide-react'
import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router'
import { AppLink } from '@/components/app-link'
import { formatDateTime, relativeTime } from '@/lib/dates'
import { neighbour } from '@/lib/list-context'
import { useCan } from '@/lib/session'
import { useShortcut, withKeys } from '@/lib/shortcuts'
import { orderQueries, useOrderMutations } from '../api'
import { ageText, ageTone, isWholePhone, telLink, waLink } from '../format'
import { describeEvent, humanise, methodLabel, orderMessage } from '../labels'
import { OrderActionDialog } from './order-actions'
import { OrderEditDialog } from './order-edit-dialog'
import { RiskChips } from './risk-chips'

/** @typedef {import('../api').AdminOrder} AdminOrder */
/** @typedef {'confirm' | 'dispatch' | 'deliver' | 'cancel' | 'revert' | 'return' | 'payment' | 'attempt' | 'tracking'} ActionId */

const rupees = (/** @type {{ amount: number }} */ m) => formatMoney({ amount: m.amount, currency: 'PKR' }, 'en')

/**
 * What the server may offer (`allowedActions`) and who may do it: the permission of each, the dialog it opens, its words (plan/07-admin/05-orders.md section 4).
 * `switch_to_cod` is not here: only the customer switches a payment method.
 * @type {Record<string, { action: ActionId | 'edit'; label: string; permission: import('@noor/contract').Permission; danger?: boolean }>}
 */
const offers = {
  confirm: { action: 'confirm', label: 'Confirm order', permission: 'orders:confirm' },
  dispatch: { action: 'dispatch', label: 'Mark dispatched', permission: 'orders:dispatch' },
  deliver: { action: 'deliver', label: 'Mark delivered', permission: 'orders:deliver' },
  record_payment: { action: 'payment', label: 'Record payment', permission: 'orders:payments' },
  edit_address: { action: 'edit', label: 'Edit address or items', permission: 'orders:edit' },
  edit_items: { action: 'edit', label: 'Edit address or items', permission: 'orders:edit' },
  update_tracking: { action: 'tracking', label: 'Edit tracking', permission: 'orders:dispatch' },
  revert_confirmation: { action: 'revert', label: 'Revert to pending confirmation', permission: 'orders:confirm' },
  return: { action: 'return', label: 'Mark returned', permission: 'orders:return', danger: true },
  cancel: { action: 'cancel', label: 'Cancel order', permission: 'orders:cancel', danger: true },
}
/** The note box of the order, for the key that goes to it. */
function focusNote() {
  const box = document.querySelector('textarea[aria-label="New note"]')
  if (box instanceof HTMLElement) box.focus()
}

/** The key of each action that has one, for its tooltip. */
const keysOf = /** @type {Record<string, string>} */ ({ confirm: 'shift+c', dispatch: 'shift+d', deliver: 'shift+l' })
/** The one action a status is waiting for. */
const primaryFor = /** @type {Record<string, string>} */ ({ pending: 'record_payment', pending_confirmation: 'confirm', confirmed: 'dispatch', dispatched: 'deliver' })

/** @param {{ label: string; value: import('react').ReactNode; strong?: boolean }} props */
function Row({ label, value, strong }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? 'font-semibold' : ''}`}>
      <dt className={strong ? '' : 'text-muted'}>{label}</dt>
      <dd className="text-end tabular-nums">{value}</dd>
    </div>
  )
}

/** @param {{ title: string; children: import('react').ReactNode; action?: import('react').ReactNode }} props */
function Block({ title, children, action }) {
  return (
    <Card render={<section aria-label={title} />} className="space-y-3">
      <header className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        {action}
      </header>
      {children}
    </Card>
  )
}

/** The lines of the order, with what was chosen on each. @param {{ order: AdminOrder }} props */
function Items({ order }) {
  const held = ['pending', 'pending_confirmation', 'confirmed'].includes(order.status)
  return (
    <Block title="Items">
      <ul className="divide-y divide-line">
        {order.lines.map((l) => (
          <li key={l.id} className="flex gap-3 py-3 first:pt-0">
            {l.image ? <img src={l.image.src} alt="" width={56} height={72} className="h-18 w-14 shrink-0 rounded-media object-cover" /> : <span aria-hidden className="h-18 w-14 shrink-0 rounded-media bg-surface-2" />}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{l.title}</p>
              <p className="text-sm text-muted">
                {l.variantLabel} · SKU <span dir="ltr">{l.sku}</span>
              </p>
              {l.stockTracked && held ? <Badge className="mt-1 text-xs">Stock reserved</Badge> : null}
              {l.leadTime ? <p className="text-xs text-muted">Made to order: {l.leadTime.minDays}–{l.leadTime.maxDays} days</p> : null}
              {l.returnedQuantity > 0 ? <p className="text-xs text-warning">{l.returnedQuantity} of {l.quantity} returned</p> : null}
              {l.customization ? (
                <details className="mt-1 text-sm">
                  <summary className="cursor-pointer text-accent-text">{l.customization.summary ?? 'Custom order'}</summary>
                  <ul className="mt-1 space-y-0.5 ps-4 text-muted">
                    {Object.entries(l.customization.measurements ?? {}).map(([k, v]) => (
                      <li key={k}>{humanise(k)}: {String(v)}</li>
                    ))}
                    {l.customization.notes ? <li>Notes: {l.customization.notes}</li> : null}
                    {(l.customization.bundle ?? []).map((b) => (
                      <li key={b.variantId}>{b.title ?? 'Item'}{b.label ? ` · ${b.label}` : ''}{b.sku ? ` · ${b.sku}` : ''}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
            <div className="text-end text-sm tabular-nums">
              <p>{l.quantity} × {rupees(l.unitPrice)}</p>
              <p className="font-medium">{rupees(l.lineSubtotal)}</p>
            </div>
          </li>
        ))}
      </ul>
      <dl className="space-y-1 border-t border-line pt-3 text-sm">
        <Row label="Subtotal" value={rupees(order.subtotal)} />
        {order.discount.amount > 0 ? <Row label={`Discount${order.promoCode ? ` (${order.promoCode})` : ''}`} value={`−${rupees(order.discount)}`} /> : null}
        <Row label={`Delivery: ${order.shipping.label}`} value={rupees(order.shippingFee)} />
        <Row label="Total" value={rupees(order.total)} strong />
        {order.depositDue.amount > 0 ? <Row label="Deposit due" value={rupees(order.depositDue)} /> : null}
        {order.paid.amount > 0 ? <Row label="Paid" value={rupees(order.paid)} /> : null}
        {order.refunded.amount > 0 ? <Row label="Refunded" value={rupees(order.refunded)} /> : null}
        <Row label={order.paymentMethod === 'cod' ? 'Cash to collect on delivery' : 'Still to pay'} value={rupees(order.dueOnDelivery)} strong />
      </dl>
    </Block>
  )
}

/** Name, phone with its buttons, history with us. @param {{ order: AdminOrder }} props */
function Customer({ order }) {
  const toast = useToast()
  const c = order.customer
  const phone = telLink(c.phone)
  const wa = waLink(c.phone)
  return (
    <Block title="Customer">
      <div>
        <p className="font-medium">
          {c.name}
          {c.vip ? <Badge tone="accent" className="ms-2 text-xs">VIP</Badge> : null}
        </p>
        <p className="text-sm text-muted">
          {c.ordersCount === 1 ? 'First order' : `${c.ordersCount} orders`} · {c.deliveredCount} delivered
          {c.refusedCount ? ` · ${c.refusedCount} refused` : ''}
        </p>
        <RiskChips markers={order.riskMarkers} />
        {order.duplicateOf ? (
          <p className="mt-1 text-sm">
            Same phone, another order in the last day: <AppLink to={`/orders/${order.duplicateOf.id}`}>{order.duplicateOf.orderNumber}</AppLink>
          </p>
        ) : null}
      </div>
      <p className="flex flex-wrap items-center gap-2" dir="ltr">
        <span className="font-medium">{c.phone}</span>
        {phone ? <LinkButton href={phone} size="md" variant="secondary" iconStart={<Phone aria-hidden className="size-4" />}>Call</LinkButton> : null}
        {wa ? <LinkButton href={order.whatsappConfirmUrl ?? wa} size="md" variant="secondary" iconStart={<MessageCircle aria-hidden className="size-4" />} target="_blank">WhatsApp</LinkButton> : null}
        {isWholePhone(c.phone) ? (
          <IconButton size="sm" label="Copy number" icon={<Copy aria-hidden className="size-4" />} onClick={() => void navigator.clipboard?.writeText(c.phone).then(() => toast.push({ title: 'Number copied', tone: 'success' }))} />
        ) : null}
      </p>
      {c.email ? <p className="text-sm">{c.email}</p> : null}
      <AppLink to={`/customers/${c.id}`} className="text-sm text-accent-text underline underline-offset-2">All orders of this customer</AppLink>
    </Block>
  )
}

/** Where it goes and how it travels. @param {{ order: AdminOrder; onEdit?: () => void }} props */
function Delivery({ order, onEdit }) {
  const a = order.shippingAddress
  return (
    <Block title="Delivery" action={onEdit ? <Button size="sm" variant="secondary" onClick={onEdit}>Edit</Button> : null}>
      <address className="text-sm not-italic">
        {a.address ?? <span className="text-muted">Address hidden for your role</span>}
        <br />
        {a.city}
        {a.landmark ? <> · near {a.landmark}</> : null}
      </address>
      {a.notes ? <p className="text-sm text-muted">Customer note: {a.notes}</p> : null}
      <p className="text-sm">
        {order.shipping.label} · {order.shipping.etaMinDays}–{order.shipping.etaMaxDays} days
      </p>
      {order.courier ? (
        <p className="text-sm">
          {order.courier.name}
          {order.trackingNumber ? <> · <span dir="ltr">{order.trackingNumber}</span></> : null}
          {order.trackingUrl ? <> · <Link href={order.trackingUrl} target="_blank" className="text-accent-text underline underline-offset-2">Track</Link></> : null}
        </p>
      ) : null}
    </Block>
  )
}

/** Method, status and every payment recorded. @param {{ order: AdminOrder; onPay?: () => void }} props */
function Payment({ order, onPay }) {
  return (
    <Block title="Payment" action={onPay ? <Button size="sm" variant="secondary" onClick={onPay}>Record payment</Button> : null}>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        {methodLabel(order.paymentMethod)}
        <StatusBadge status={order.paymentStatus} />
      </p>
      {order.payments.length ? (
        <ul className="divide-y divide-line text-sm">
          {order.payments.map((p) => (
            <li key={p.id} className="flex items-baseline justify-between gap-3 py-2">
              <span>
                {p.kind === 'refund' ? 'Refund' : humanise(p.kind)} · {methodLabel(p.method)}
                {p.reference ? <span className="text-muted" dir="ltr"> · {p.reference}</span> : null}
                <span className="block text-xs text-muted">
                  {formatDateTime(p.createdAt)}{p.recordedBy ? ` · ${p.recordedBy}` : ''} · {humanise(p.state)}
                </span>
              </span>
              <span className="tabular-nums">{p.kind === 'refund' ? '−' : ''}{rupees(p.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No payment recorded.</p>
      )}
    </Block>
  )
}

/** Tries to reach the customer, and the suggestion after three on two different days (section 5.1). @param {{ order: AdminOrder; onLog?: () => void }} props */
function Confirmation({ order, onLog }) {
  const attempts = order.events.filter((e) => e.type === 'confirmation_attempt')
  const days = new Set(attempts.map((e) => formatDateTime(e.createdAt).split(',')[0]))
  const suggest = order.status === 'pending_confirmation' && attempts.length >= 3 && days.size >= 2
  if (order.status !== 'pending_confirmation' && attempts.length === 0) return null
  return (
    <Block title="Confirmation" action={onLog && order.status === 'pending_confirmation' ? <Button size="sm" variant="secondary" onClick={onLog}>Log attempt</Button> : null}>
      {suggest ? <Badge tone="warning">Three attempts on two days: consider cancelling as unreachable</Badge> : null}
      {attempts.length ? (
        <ol className="space-y-1 text-sm">
          {attempts.map((e, i) => (
            <li key={e.id}>
              Attempt {attempts.length - i} · {formatDateTime(e.createdAt)} · {describeEvent(e).replace(/^Tried to reach the customer by /, '')}
              {e.actorLabel ? <span className="text-muted"> · {e.actorLabel}</span> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">No attempt logged yet.</p>
      )}
    </Block>
  )
}

/** Everything that happened, newest first. @param {{ order: AdminOrder }} props */
function Timeline({ order }) {
  return (
    <Block title="Timeline">
      <ol className="space-y-3">
        {order.events.map((e) => (
          <li key={e.id} className="flex gap-3 text-sm">
            <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
            <span className="min-w-0">
              <span className="block break-words">{describeEvent(e)}</span>
              <span className="text-xs text-muted" title={formatDateTime(e.createdAt, true)}>
                {relativeTime(e.createdAt)}{e.actorLabel ? ` · ${e.actorLabel}` : e.actorType === 'storefront' ? ' · customer' : ''}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </Block>
  )
}

/** Add-only notes: each is an event, so none can be overwritten (F-03). @param {{ order: AdminOrder }} props */
function Notes({ order }) {
  const { note } = useOrderMutations(order.id)
  const [text, setText] = useState('')
  const notes = order.events.filter((e) => e.type === 'note')
  return (
    <Block title="Internal notes">
      <p className="text-xs text-muted">Only staff see these.</p>
      {notes.length ? (
        <ul className="space-y-2 text-sm">
          {notes.map((n) => (
            <li key={n.id} className="rounded-control bg-surface-2 p-2">
              <span className="whitespace-pre-wrap break-words">{String(n.data?.body ?? '')}</span>
              <span className="block text-xs text-muted">{n.actorLabel} · {formatDateTime(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) note.mutate(text.trim(), { onSuccess: () => setText('') })
        }}
      >
        <Textarea aria-label="New note" rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
        {note.error ? <p role="alert" className="text-sm text-danger">{orderMessage(note.error)}</p> : null}
        <Button type="submit" size="sm" variant="secondary" loading={note.isPending} disabled={!text.trim()}>
          Add note
        </Button>
      </form>
    </Block>
  )
}

/** `/orders/:id` (plan/07-admin/05-orders.md section 3). @param {{ id: string }} props */
export function OrderDetail({ id }) {
  const can = useCan()
  const query = useQuery(orderQueries.detail(id))
  const { refetch } = useOrderMutations(id)
  const [action, setAction] = useState(/** @type {ActionId | 'edit' | null} */ (null))
  /** The version this person has been working on; a newer one that they did not make is shown as "updated". */
  const [seen, setSeen] = useState(/** @type {number | null} */ (null))
  const [conflict, setConflict] = useState(false)
  const order = query.data
  const navigate = useNavigate()

  // keys of this screen (plan/07-admin/15-shortcuts.md section 4): each only opens the dialog of its button, and only while the server allows the action and the role may do it
  const may = (/** @type {string} */ a) => order !== undefined && order.allowedActions.includes(/** @type {never} */ (a)) && can(/** @type {import('@noor/contract').Permission} */ (offers[a]?.permission ?? 'orders:read'))
  const wa = order ? (order.whatsappConfirmUrl ?? waLink(order.customer.phone)) : undefined
  const next = neighbour('orders', order ? [id, order.id, order.orderNumber] : [id], 1)
  const previous = neighbour('orders', order ? [id, order.id, order.orderNumber] : [id], -1)
  useShortcut('a', () => setAction('attempt'), { label: 'Log a confirmation attempt', when: order?.status === 'pending_confirmation' && can('orders:note') })
  useShortcut('shift+c', () => setAction('confirm'), { label: 'Confirm order', when: may('confirm') })
  useShortcut('shift+d', () => setAction('dispatch'), { label: 'Mark dispatched', when: may('dispatch') })
  useShortcut('shift+l', () => setAction('deliver'), { label: 'Mark delivered', when: may('deliver') })
  useShortcut('w', () => window.open(wa, '_blank', 'noopener'), { label: 'Open WhatsApp to the customer', when: wa !== undefined })
  useShortcut('i', () => window.open(`/orders/${order?.id}/print`, '_blank', 'noopener'), { label: 'Print the invoice', when: order !== undefined })
  useShortcut('m', focusNote, { label: 'Write an internal note', when: order !== undefined && can('orders:note') })
  useShortcut(']', () => void navigate(`/orders/${next}`), { label: 'Next order of the list', when: next !== undefined })
  useShortcut('shift+]', () => void navigate(`/orders/${previous}`), { label: 'Previous order of the list', when: previous !== undefined })

  if (query.isPending) return <Skeleton className="h-96 w-full" />
  if (query.isError || !order) return <ErrorState title="This order could not be loaded" retryLabel="Try again" onRetry={() => void query.refetch()} />

  const known = seen ?? order.version
  const updatedElsewhere = conflict || order.version > known
  const taken = new Set()
  const allowed = order.allowedActions.filter((a) => {
    const o = offers[a]
    // cash on delivery is taken at the door and recorded with "delivered"; a payment by hand is for prepaid orders and for a deposit still owed
    if (a === 'record_payment' && order.paymentMethod === 'cod' && order.depositDue.amount <= order.paid.amount) return false
    if (!o || !can(o.permission) || taken.has(o.action)) return false
    taken.add(o.action)
    return true
  })
  const primaryKey = primaryFor[order.status]
  const primary = primaryKey && /** @type {string[]} */ (allowed).includes(primaryKey) ? primaryKey : undefined
  const others = allowed.filter((a) => a !== primary)
  const open = (/** @type {string} */ a) => setAction(/** @type {ActionId | 'edit'} */ (offers[a]?.action ?? null))
  const tone = ageTone(order.status, order.statusChangedAt)

  return (
    <>
      <header className="mb-4 space-y-2">
        <AppLink to="/orders" className="inline-flex items-center gap-1 text-sm text-accent-text">
          <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" /> Orders
        </AppLink>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold">{order.orderNumber}</h1>
            <StatusBadge status={order.status} />
            <span className="text-sm text-muted" title={formatDateTime(order.placedAt)}>
              Placed {relativeTime(order.placedAt)} · {order.channel === 'admin' ? 'typed by staff' : 'website'}
            </span>
            {order.status === 'pending_confirmation' ? <Badge tone={tone}>Waiting {ageText(order.statusChangedAt)}</Badge> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tooltip content={withKeys('Print invoice', 'i')}>
              <LinkButton href={`/orders/${order.id}/print`} size="md" variant="secondary" iconStart={<Printer aria-hidden className="size-4" />} render={<RouterLink to={`/orders/${order.id}/print`} target="_blank" />}>
                Print invoice
              </LinkButton>
            </Tooltip>
            {others.length ? (
              <Menu
                align="end"
                trigger={<Button size="md" variant="secondary" iconEnd={<ChevronDown aria-hidden className="size-4" />}>More</Button>}
                items={others.map((a) => ({ label: offers[a]?.label ?? a, tone: offers[a]?.danger ? /** @type {const} */ ('danger') : undefined, onSelect: () => open(a) }))}
              />
            ) : null}
            {primary ? (
              <Tooltip content={keysOf[primary] ? withKeys(offers[primary]?.label ?? '', keysOf[primary]) : (offers[primary]?.label ?? '')}>
                <Button size="md" onClick={() => open(primary)}>
                  {offers[primary]?.label}
                </Button>
              </Tooltip>
            ) : null}
          </div>
        </div>
      </header>

      {updatedElsewhere ? (
        <p role="status" className="mb-4 flex items-center justify-between gap-3 rounded-control bg-warning-soft px-3 py-2 text-sm">
          This order was updated: showing the latest.
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setSeen(order.version)
              setConflict(false)
            }}
          >
            Dismiss
          </Button>
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Items order={order} />
          <Confirmation order={order} onLog={can('orders:note') ? () => setAction('attempt') : undefined} />
          <Timeline order={order} />
        </div>
        <div className="space-y-4">
          <Customer order={order} />
          <Delivery order={order} onEdit={allowed.some((a) => offers[a]?.action === 'edit') ? () => setAction('edit') : undefined} />
          <Payment order={order} onPay={allowed.includes('record_payment') ? () => setAction('payment') : undefined} />
          {can('orders:note') ? <Notes order={order} /> : null}
        </div>
      </div>

      {action === 'edit' ? (
        <OrderEditDialog
          order={order}
          onClose={() => setAction(null)}
          onChanged={(o) => setSeen(o.version)}
          onConflict={() => {
            setConflict(true)
            void refetch()
          }}
        />
      ) : (
        <OrderActionDialog
          action={action}
          order={order}
          onClose={() => setAction(null)}
          onChanged={(o) => setSeen(o.version)}
          onConflict={() => {
            setConflict(true)
            void refetch()
          }}
        />
      )}
    </>
  )
}
