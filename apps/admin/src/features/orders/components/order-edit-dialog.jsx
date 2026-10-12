import { formatMoney } from '@noor/i18n/format'
import { Button } from '@noor/ui/button'
import { Dialog } from '@noor/ui/dialog'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { NumberInput } from '@noor/ui/number-input'
import { Textarea } from '@noor/ui/textarea'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { orderQueries, useOrderMutations } from '../api'
import { isConflict, orderMessage } from '../labels'

/** @typedef {import('../api').AdminOrder} AdminOrder */

const rupees = (/** @type {{ amount: number }} */ m) => formatMoney({ amount: m.amount, currency: 'PKR' }, 'en')

/** Old and new total side by side. @param {{ label: string; before: import('@noor/contract').Money; after: import('@noor/contract').Money }} props */
function Change({ label, before, after }) {
  const same = before.amount === after.amount
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">{same ? rupees(after) : <><s className="text-muted">{rupees(before)}</s> → <strong>{rupees(after)}</strong></>}</dd>
    </div>
  )
}

/**
 * Change the address, the city (which re-prices delivery) or the quantity of a line, with the server's own figures shown before anything is saved (plan/07-admin/05-orders.md section 5.1).
 * The screen never works a total out itself: `previewEdit` does, and `edit` saves exactly what was previewed. Adding a line by SKU comes with staff-typed orders (DOC-07.6).
 * @param {{ order: AdminOrder; onClose: () => void; onChanged: (o: AdminOrder) => void; onConflict: () => void }} props
 */
export function OrderEditDialog({ order, onClose, onChanged, onConflict }) {
  const canAddress = order.allowedActions.includes('edit_address') && order.shippingAddress.address !== undefined
  const canItems = order.allowedActions.includes('edit_items')
  const lookups = useQuery(orderQueries.lookups())
  const { edit } = useOrderMutations(order.id)
  const [cityId, setCityId] = useState(order.shippingAddress.cityId)
  const [address, setAddress] = useState(order.shippingAddress.address ?? '')
  const [landmark, setLandmark] = useState(order.shippingAddress.landmark ?? '')
  const [notes, setNotes] = useState(order.shippingAddress.notes ?? '')
  const [qty, setQty] = useState(/** @type {Record<string, number>} */ (Object.fromEntries(order.lines.map((l) => [l.id, l.quantity]))))

  const addressChanged = canAddress && (cityId !== order.shippingAddress.cityId || address.trim() !== (order.shippingAddress.address ?? '') || landmark.trim() !== (order.shippingAddress.landmark ?? '') || notes.trim() !== (order.shippingAddress.notes ?? ''))
  const linesChanged = canItems && order.lines.some((l) => (qty[l.id] ?? l.quantity) !== l.quantity)
  const kept = order.lines.filter((l) => (qty[l.id] ?? l.quantity) > 0)
  const body = /** @type {never} */ ({
    version: order.version,
    ...(addressChanged ? { shippingAddress: { cityId, address: address.trim(), ...(landmark.trim() ? { landmark: landmark.trim() } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) } } : {}),
    ...(linesChanged ? { lines: kept.map((l) => ({ lineId: l.id, quantity: qty[l.id] ?? l.quantity })) } : {}),
  })
  const changed = addressChanged || linesChanged
  const valid = (!addressChanged || address.trim().length >= 10) && kept.length > 0
  const preview = useQuery({
    queryKey: ['orders', 'edit-preview', order.id, JSON.stringify(body)],
    queryFn: ({ signal }) => api('admin.orders.previewEdit', { params: { id: order.id }, body, signal }),
    enabled: changed && valid,
    retry: false,
    staleTime: 0,
  })

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Edit ${order.orderNumber}`}
      description="Prices and delivery are worked out again on the server. Check the new total before saving."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={edit.isPending}
            disabled={!changed || !valid || !preview.isSuccess || preview.data.issues.length > 0}
            onClick={() =>
              edit.mutate(body, {
                onSuccess: (o) => {
                  onChanged(o)
                  onClose()
                },
                onError: (e) => {
                  if (isConflict(e)) {
                    onConflict()
                    onClose()
                  }
                },
              })
            }
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {canAddress ? (
          <fieldset className="space-y-3">
            <legend className="mb-1 text-sm font-medium">Delivery</legend>
            <Field label="City" required>
              <NativeSelect options={(lookups.data?.cities ?? [{ id: order.shippingAddress.cityId, name: order.shippingAddress.city }]).map((c) => ({ value: c.id, label: c.name }))} value={cityId} onChange={(e) => setCityId(e.target.value)} />
            </Field>
            <Field label="Address" required error={addressChanged && address.trim().length < 10 ? 'Give the full address (at least 10 characters).' : undefined}>
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
          </fieldset>
        ) : null}
        {canItems ? (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Items</legend>
            {order.lines.map((l) => (
              <div key={l.id} className="grid grid-cols-[1fr_6rem] items-center gap-3 rounded-control border border-line p-2">
                <span className="min-w-0 text-sm">
                  {l.title}
                  <span className="block text-xs text-muted">{l.variantLabel} · {l.sku} · {rupees(l.unitPrice)} each</span>
                </span>
                <NumberInput aria-label={`Quantity of ${l.title}, ${l.variantLabel}`} min={0} max={99} value={qty[l.id] ?? l.quantity} onValueChange={(v) => setQty((q) => ({ ...q, [l.id]: v ?? 0 }))} />
              </div>
            ))}
            <p className="text-xs text-muted">Set a quantity to 0 to remove the line. An order keeps at least one.</p>
          </fieldset>
        ) : null}
        {changed && valid ? (
          <section aria-live="polite" className="rounded-control bg-surface-2 p-3">
            {preview.isPending ? <p className="text-sm text-muted">Working out the new total…</p> : null}
            {preview.isError ? <p role="alert" className="text-sm text-danger">{orderMessage(preview.error)}</p> : null}
            {preview.isSuccess ? (
              <dl className="space-y-1">
                <Change label="Subtotal" before={preview.data.before.subtotal} after={preview.data.after.subtotal} />
                <Change label="Discount" before={preview.data.before.discount} after={preview.data.after.discount} />
                <Change label="Delivery" before={preview.data.before.shippingFee} after={preview.data.after.shippingFee} />
                <Change label="Total" before={preview.data.before.total} after={preview.data.after.total} />
                {preview.data.before.depositDue.amount !== preview.data.after.depositDue.amount ? <Change label="Deposit due" before={preview.data.before.depositDue} after={preview.data.after.depositDue} /> : null}
                {!preview.data.promoStillApplies && order.promoCode ? <p className="pt-1 text-sm text-warning">The promo code {order.promoCode} no longer applies after this change.</p> : null}
                {preview.data.issues.map((i) => <p key={i} className="pt-1 text-sm text-danger">{i}</p>)}
              </dl>
            ) : null}
          </section>
        ) : null}
        {edit.error ? <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">{orderMessage(edit.error)}</p> : null}
      </div>
    </Dialog>
  )
}
