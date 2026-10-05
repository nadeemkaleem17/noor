import { adjustReasons, ApiError } from '@noor/contract'
import { Button } from '@noor/ui/button'
import { Dialog } from '@noor/ui/dialog'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { NumberInput } from '@noor/ui/number-input'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { FormError } from '@/components/form-error'
import { api } from '@/lib/api'

const modes = [
  { value: 'add', label: 'Add' },
  { value: 'remove', label: 'Remove' },
  { value: 'set', label: 'Set to' },
]
const reasons = /** @type {Record<string, string>} */ ({ restock: 'Restock', correction: 'Count correction', damaged: 'Damaged', return_restock: 'Returned to stock', other: 'Other' })

/**
 * Changes the stock of one variant by a delta, with a reason (plan/07-admin/03-products.md section 7.1). Stock is never part of the product form:
 * saving a product cannot overwrite a sale made while the editor was open.
 * @param {{ variant: { id: string; sku: string; onHand?: number; reserved?: number; } | null; onClose: () => void; onAdjusted: (result: { variantId: string; onHand: number; reserved: number; stockStatus: string; }) => void; }} props
 */
export function StockDialog({ variant, onClose, onAdjusted }) {
  const [mode, setMode] = useState('add')
  const [quantity, setQuantity] = useState(/** @type {number | null} */ (null))
  const [reason, setReason] = useState('restock')
  const [note, setNote] = useState('')
  const adjust = useMutation({
    mutationFn: () =>
      api('admin.inventory.adjust', {
        body: /** @type {never} */ ({ variantId: variant?.id, mode, quantity: quantity ?? 0, reason, ...(note.trim() ? { note: note.trim() } : {}) }),
      }),
    onSuccess: (result) => {
      onAdjusted(result)
      onClose()
    },
  })
  const needsNote = reason === 'damaged' || reason === 'other'
  const error = adjust.error
  const belowReserved = error instanceof ApiError && error.code === 'stock_below_reserved'
  return (
    <Dialog
      open={variant !== null}
      onOpenChange={(open) => !open && onClose()}
      title={`Adjust stock: ${variant?.sku ?? ''}`}
      description={`On hand ${variant?.onHand ?? 0}, held by open orders ${variant?.reserved ?? 0}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={adjust.isPending} disabled={quantity === null || (needsNote && !note.trim())} onClick={() => adjust.mutate()}>
            Apply
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Change">
          <NativeSelect options={modes} value={mode} onChange={(e) => setMode(e.target.value)} />
        </Field>
        <Field label="Quantity" required>
          <NumberInput min={0} value={quantity} onValueChange={setQuantity} />
        </Field>
        <Field label="Reason" required>
          <NativeSelect options={adjustReasons.map((r) => ({ value: r, label: reasons[r] ?? r }))} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label="Note" required={needsNote} hint={needsNote ? 'Say what happened.' : undefined}>
          <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {belowReserved ? (
          <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
            That would leave less than the {String(error.details.reserved ?? variant?.reserved ?? 0)} units held by open orders.
          </p>
        ) : (
          <FormError error={error} />
        )}
      </div>
    </Dialog>
  )
}
