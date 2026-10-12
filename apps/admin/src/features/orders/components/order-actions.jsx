import { formatMoney } from '@noor/i18n/format'
import { Button } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { Dialog } from '@noor/ui/dialog'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { MoneyInput } from '@noor/ui/money-input'
import { NativeSelect } from '@noor/ui/native-select'
import { NumberInput } from '@noor/ui/number-input'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { fromLocalInput, toLocalInput } from '@/lib/dates'
import { orderQueries, useOrderMutations } from '../api'
import { attemptOutcomes, cancelReasons, isConflict, orderMessage, paymentMethods, returnTypes } from '../labels'

/** @typedef {import('../api').AdminOrder} AdminOrder */

/**
 * @typedef {object} ActionProps
 * @property {AdminOrder} order
 * @property {() => void} onClose
 * @property {(order: AdminOrder) => void} onChanged - the order the server answered with
 * @property {() => void} onConflict - the order changed under the person: the screen refetches and says so
 */

const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })
const rupees = (/** @type {{ amount: number }} */ m) => formatMoney({ amount: m.amount, currency: 'PKR' }, 'en')

/**
 * The frame every action shares: a dialog with Cancel and a submit button that waits, and the server's refusal in words under the fields.
 * @param {{ title: string; description?: string; submit: string; tone?: 'danger'; disabled?: boolean; pending: boolean; error: unknown; onSubmit: () => void; onClose: () => void; children: import('react').ReactNode; size?: 'sm' | 'md' | 'lg' }} props
 */
function Shell({ title, description, submit, tone, disabled, pending, error, onSubmit, onClose, children, size }) {
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description={description}
      size={size}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={pending} disabled={disabled} onClick={onSubmit}>
            {submit}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!disabled) onSubmit()
        }}
      >
        {children}
        {error ? (
          <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
            {orderMessage(error)}
          </p>
        ) : null}
      </form>
    </Dialog>
  )
}

/**
 * Runs a mutation of the order, and tells the screen what came of it.
 * @template V
 * @param {{ mutate: (v: V, o: { onSuccess: (o: AdminOrder) => void; onError: (e: unknown) => void }) => void }} m
 * @param {ActionProps} p
 */
function useRun(m, p) {
  return (/** @type {V} */ v) =>
    m.mutate(v, {
      onSuccess: (o) => {
        p.onChanged(o)
        p.onClose()
      },
      onError: (e) => {
        if (isConflict(e)) {
          p.onConflict()
          p.onClose()
        }
      },
    })
}

const vias = [
  { value: 'call', label: 'Called the customer' },
  { value: 'whatsapp', label: 'WhatsApp conversation' },
  { value: 'customer_message', label: 'Customer wrote to us' },
]

/** Confirm a cash on delivery order (section 4.1). With a deposit due, the button waits for a payment that covers it. @param {ActionProps} p */
function ConfirmAction(p) {
  const { order } = p
  const { transition } = useOrderMutations(order.id)
  const [via, setVia] = useState('call')
  const [note, setNote] = useState('')
  const [override, setOverride] = useState('')
  const blocked = order.riskMarkers.includes('cod_blocked')
  const depositOpen = order.depositDue.amount > 0 && order.paid.amount < order.depositDue.amount
  const run = useRun(transition, p)
  return (
    <Shell
      title={`Confirm ${order.orderNumber}`}
      submit="Confirm order"
      pending={transition.isPending}
      error={transition.error}
      disabled={depositOpen || (blocked && !override.trim())}
      onClose={p.onClose}
      onSubmit={() => run({ version: order.version, to: 'confirmed', via: /** @type {'call'} */ (via), ...(note.trim() ? { note: note.trim() } : {}), ...(blocked ? { codOverrideReason: override.trim() } : {}) })}
    >
      {depositOpen ? <p className="rounded-control bg-warning-soft px-3 py-2 text-sm">A deposit of {rupees(order.depositDue)} is due and not recorded yet. Record the payment first.</p> : null}
      <Field label="Confirmed how?" required>
        <NativeSelect options={vias} value={via} onChange={(e) => setVia(e.target.value)} />
      </Field>
      {blocked ? (
        <Field label="Why confirm cash on delivery for this customer?" required hint="This customer is flagged for no cash on delivery.">
          <Input value={override} maxLength={300} onChange={(e) => setOverride(e.target.value)} />
        </Field>
      ) : null}
      <Field label="Note">
        <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Shell>
  )
}

/** Send the order off: courier, tracking number, date (section 4.1). @param {ActionProps} p */
function DispatchAction(p) {
  const { order } = p
  const { transition } = useOrderMutations(order.id)
  const lookups = useQuery(orderQueries.lookups())
  const [courierId, setCourierId] = useState('')
  const [tracking, setTracking] = useState('')
  const [when, setWhen] = useState(toLocalInput(new Date().toISOString()))
  const courier = lookups.data?.couriers.find((c) => c.id === courierId)
  const run = useRun(transition, p)
  return (
    <Shell
      title={`Dispatch ${order.orderNumber}`}
      description="Stock held for this order is taken off the shelf, and the customer is told."
      submit="Mark dispatched"
      pending={transition.isPending}
      error={transition.error}
      disabled={!courierId || (courier?.trackingRequired === true && !tracking.trim())}
      onClose={p.onClose}
      onSubmit={() => run({ version: order.version, to: 'dispatched', courierId, ...(tracking.trim() ? { trackingNumber: tracking.trim() } : {}), ...(fromLocalInput(when) ? { dispatchedAt: fromLocalInput(when) } : {}) })}
    >
      <Field label="Courier" required>
        <NativeSelect options={[{ value: '', label: 'Choose a courier' }, ...(lookups.data?.couriers ?? []).map((c) => ({ value: c.id, label: c.name }))]} value={courierId} onChange={(e) => setCourierId(e.target.value)} />
      </Field>
      <Field label="Tracking number" required={courier?.trackingRequired} hint={courier && !courier.trackingRequired ? 'Not needed for this courier.' : undefined}>
        <Input value={tracking} maxLength={60} dir="ltr" onChange={(e) => setTracking(e.target.value)} />
      </Field>
      <Field label="Dispatched on">
        <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      </Field>
    </Shell>
  )
}

/** Mark delivered, and say whether the cash came (section 4.1). @param {ActionProps} p */
function DeliverAction(p) {
  const { order } = p
  const { transition } = useOrderMutations(order.id)
  const cod = order.paymentMethod === 'cod'
  const [cash, setCash] = useState(cod)
  const [when, setWhen] = useState(toLocalInput(new Date().toISOString()))
  const run = useRun(transition, p)
  return (
    <Shell
      title={`Mark ${order.orderNumber} delivered`}
      submit="Mark delivered"
      pending={transition.isPending}
      error={transition.error}
      onClose={p.onClose}
      onSubmit={() => run({ version: order.version, to: 'delivered', ...(fromLocalInput(when) ? { deliveredAt: fromLocalInput(when) } : {}), ...(cod ? { cashReceived: cash } : {}) })}
    >
      {cod ? <Checkbox label={`Cash received: ${rupees(order.dueOnDelivery)}`} checked={cash} onCheckedChange={setCash} /> : null}
      <Field label="Delivered on">
        <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      </Field>
    </Shell>
  )
}

/** Cancel with a reason; money taken must be acknowledged (section 4.1). @param {ActionProps} p */
function CancelAction(p) {
  const { order } = p
  const { transition } = useOrderMutations(order.id)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [ack, setAck] = useState(false)
  const refundDue = order.paid.amount - order.refunded.amount
  const run = useRun(transition, p)
  return (
    <Shell
      title={`Cancel ${order.orderNumber}`}
      description="Stock held for the order is released and the promo code can be used again."
      submit="Cancel order"
      tone="danger"
      pending={transition.isPending}
      error={transition.error}
      disabled={!reason || (refundDue > 0 && !ack)}
      onClose={p.onClose}
      onSubmit={() => run({ version: order.version, to: 'cancelled', reason: /** @type {'other'} */ (reason), ...(note.trim() ? { note: note.trim() } : {}), ...(refundDue > 0 ? { refundAcknowledged: ack } : {}) })}
    >
      <Field label="Reason" required>
        <NativeSelect options={[{ value: '', label: 'Choose a reason' }, ...cancelReasons.map(([value, label]) => ({ value, label }))]} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <Field label="Note" required={reason === 'other'}>
        <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {refundDue > 0 ? <Checkbox label={`${rupees(money(refundDue))} was taken and must be paid back`} checked={ack} onCheckedChange={setAck} /> : null}
    </Shell>
  )
}

/** Back to "pending confirmation", with a reason. @param {ActionProps} p */
function RevertAction(p) {
  const { order } = p
  const { transition } = useOrderMutations(order.id)
  const [reason, setReason] = useState('')
  const run = useRun(transition, p)
  return (
    <Shell
      title={`Revert ${order.orderNumber} to pending confirmation`}
      submit="Revert"
      pending={transition.isPending}
      error={transition.error}
      disabled={!reason.trim()}
      onClose={p.onClose}
      onSubmit={() => run({ version: order.version, to: 'pending_confirmation', reason: reason.trim() })}
    >
      <Field label="Reason" required>
        <Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Shell>
  )
}

/** A return: the kind, the quantity of each line, and whether each goes back on the shelf (section 4.1). @param {ActionProps} p */
function ReturnAction(p) {
  const { order } = p
  const { transition } = useOrderMutations(order.id)
  const [type, setType] = useState(order.status === 'delivered' ? 'customer_return' : 'refused_at_door')
  const [note, setNote] = useState('')
  const open = order.lines.filter((l) => l.quantity - l.returnedQuantity > 0)
  const [qty, setQty] = useState(/** @type {Record<string, number>} */ (Object.fromEntries(open.map((l) => [l.id, l.quantity - l.returnedQuantity]))))
  const [restock, setRestock] = useState(/** @type {Record<string, boolean>} */ (Object.fromEntries(open.map((l) => [l.id, true]))))
  const lines = open.filter((l) => (qty[l.id] ?? 0) > 0).map((l) => ({ lineId: l.id, quantity: qty[l.id] ?? 0, restock: restock[l.id] ?? false }))
  const run = useRun(transition, p)
  return (
    <Shell
      title={`Return on ${order.orderNumber}`}
      description="Goods that come back sellable go back on the shelf. Damaged ones are written off and do not."
      submit="Record return"
      tone="danger"
      size="lg"
      pending={transition.isPending}
      error={transition.error}
      disabled={lines.length === 0}
      onClose={p.onClose}
      onSubmit={() => run({ version: order.version, to: 'returned', returnType: /** @type {'customer_return'} */ (type), lines, ...(note.trim() ? { note: note.trim() } : {}) })}
    >
      <Field label="Kind of return" required>
        <NativeSelect options={returnTypes.map(([value, label]) => ({ value, label }))} value={type} onChange={(e) => setType(e.target.value)} />
      </Field>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">What came back</legend>
        {open.map((l) => (
          <div key={l.id} className="grid grid-cols-[1fr_6rem] items-center gap-3 rounded-control border border-line p-2">
            <span className="min-w-0 text-sm">
              {l.title}
              <span className="block text-xs text-muted">{l.variantLabel} · ordered {l.quantity}</span>
              <Checkbox label="Put back on the shelf" checked={restock[l.id] ?? false} onCheckedChange={(on) => setRestock((r) => ({ ...r, [l.id]: on }))} />
            </span>
            <NumberInput aria-label={`Quantity returned of ${l.title}`} min={0} max={l.quantity - l.returnedQuantity} value={qty[l.id] ?? 0} onValueChange={(v) => setQty((q) => ({ ...q, [l.id]: v ?? 0 }))} />
          </div>
        ))}
      </fieldset>
      <Field label="Note">
        <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Shell>
  )
}

/** A payment taken outside the shop, recorded by hand. One key per opening, so a double click records it once. @param {ActionProps} p */
function PaymentAction(p) {
  const { order } = p
  const { payment } = useOrderMutations(order.id)
  const balance = Math.max(0, order.total.amount - order.paid.amount + order.refunded.amount)
  const [amount, setAmount] = useState(/** @type {import('@noor/contract').Money | null} */ (balance > 0 ? money(order.depositDue.amount > order.paid.amount ? order.depositDue.amount - order.paid.amount : balance) : null))
  const [method, setMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const [key] = useState(() => crypto.randomUUID())
  const kind = amount && order.paid.amount + amount.amount >= order.total.amount ? 'full' : order.depositDue.amount > 0 && order.paid.amount === 0 ? 'deposit' : 'balance'
  return (
    <Shell
      title={`Record a payment on ${order.orderNumber}`}
      description={`Still to pay: ${rupees(money(balance))}.`}
      submit="Record payment"
      pending={payment.isPending}
      error={payment.error}
      disabled={!amount || amount.amount <= 0 || amount.amount > balance}
      onClose={p.onClose}
      onSubmit={() =>
        amount &&
        payment.mutate(
          { key, body: /** @type {never} */ ({ kind, amount, method, ...(reference.trim() ? { reference: reference.trim() } : {}) }) },
          {
            onSuccess: (o) => {
              p.onChanged(o)
              p.onClose()
            },
            onError: (e) => {
              if (isConflict(e)) {
                p.onConflict()
                p.onClose()
              }
            },
          },
        )
      }
    >
      <Field label="Amount" required hint="At most what is still to pay.">
        <MoneyInput value={amount} onValueChange={setAmount} />
      </Field>
      <Field label="Method" required>
        <NativeSelect options={paymentMethods.map(([value, label]) => ({ value, label }))} value={method} onChange={(e) => setMethod(e.target.value)} />
      </Field>
      <Field label="Reference" hint="The transfer or receipt number.">
        <Input value={reference} maxLength={120} dir="ltr" onChange={(e) => setReference(e.target.value)} />
      </Field>
    </Shell>
  )
}

/** A try at reaching the customer (section 5.1). @param {ActionProps} p */
function AttemptAction(p) {
  const { order } = p
  const { attempt } = useOrderMutations(order.id)
  const [channel, setChannel] = useState('call')
  const [outcome, setOutcome] = useState('no_answer')
  const [note, setNote] = useState('')
  return (
    <Shell
      title={`Log an attempt on ${order.orderNumber}`}
      submit="Save attempt"
      pending={attempt.isPending}
      error={attempt.error}
      onClose={p.onClose}
      onSubmit={() =>
        attempt.mutate(/** @type {never} */ ({ channel, outcome, ...(note.trim() ? { note: note.trim() } : {}) }), {
          onSuccess: p.onClose,
          onError: (e) => {
            if (isConflict(e)) {
              p.onConflict()
              p.onClose()
            }
          },
        })
      }
    >
      <Field label="How" required>
        <NativeSelect options={[{ value: 'call', label: 'Phone call' }, { value: 'whatsapp', label: 'WhatsApp' }]} value={channel} onChange={(e) => setChannel(e.target.value)} />
      </Field>
      <Field label="What happened" required>
        <NativeSelect options={attemptOutcomes.map(([value, label]) => ({ value, label }))} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
      </Field>
      <Field label="Note">
        <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Shell>
  )
}

/** Correct the courier or the tracking number after dispatch. @param {ActionProps} p */
function TrackingAction(p) {
  const { order } = p
  const { tracking: update } = useOrderMutations(order.id)
  const lookups = useQuery(orderQueries.lookups())
  const [courierId, setCourierId] = useState(order.courier?.id ?? '')
  const [tracking, setTracking] = useState(order.trackingNumber ?? '')
  const run = useRun(update, p)
  return (
    <Shell
      title={`Tracking of ${order.orderNumber}`}
      submit="Save"
      pending={update.isPending}
      error={update.error}
      disabled={!courierId}
      onClose={p.onClose}
      onSubmit={() => run(/** @type {never} */ ({ version: order.version, courierId, ...(tracking.trim() ? { trackingNumber: tracking.trim() } : {}) }))}
    >
      <Field label="Courier" required>
        <NativeSelect options={[{ value: '', label: 'Choose a courier' }, ...(lookups.data?.couriers ?? []).map((c) => ({ value: c.id, label: c.name }))]} value={courierId} onChange={(e) => setCourierId(e.target.value)} />
      </Field>
      <Field label="Tracking number">
        <Input value={tracking} maxLength={60} dir="ltr" onChange={(e) => setTracking(e.target.value)} />
      </Field>
    </Shell>
  )
}

/** The dialog of the action the screen is asking for. `action` is null while none is open. @param {ActionProps & { action: 'confirm' | 'dispatch' | 'deliver' | 'cancel' | 'revert' | 'return' | 'payment' | 'attempt' | 'tracking' | null }} props */
export function OrderActionDialog({ action, ...p }) {
  switch (action) {
    case 'confirm':
      return <ConfirmAction {...p} />
    case 'dispatch':
      return <DispatchAction {...p} />
    case 'deliver':
      return <DeliverAction {...p} />
    case 'cancel':
      return <CancelAction {...p} />
    case 'revert':
      return <RevertAction {...p} />
    case 'return':
      return <ReturnAction {...p} />
    case 'payment':
      return <PaymentAction {...p} />
    case 'attempt':
      return <AttemptAction {...p} />
    case 'tracking':
      return <TrackingAction {...p} />
    default:
      return null
  }
}

