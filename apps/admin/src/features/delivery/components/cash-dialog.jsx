import { Button } from '@noor/ui/button'
import { Dialog } from '@noor/ui/dialog'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { MoneyInput } from '@noor/ui/money-input'
import { useState } from 'react'
import { messageFor } from '@/lib/errors'

/**
 * One amount of cash and a note: a deposit, a fee payout, or an adjustment (which may be negative and must say why).
 * @param {{ title: string; description: string; confirmLabel: string; signed?: boolean; noteRequired?: boolean; onClose: () => void; onSubmit: (amount: number, note: string) => Promise<unknown> }} props
 */
export function CashDialog({ title, description, confirmLabel, signed = false, noteRequired = false, onClose, onSubmit }) {
  const [amount, setAmount] = useState(/** @type {import('@noor/contract').Money | null} */ (null))
  const [direction, setDirection] = useState(/** @type {1 | -1} */ (1))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const valid = amount !== null && amount.amount > 0 && (!noteRequired || note.trim().length > 0)
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            disabled={!valid}
            onClick={async () => {
              if (!amount) return
              setSaving(true)
              setError('')
              try {
                await onSubmit(amount.amount * direction, note.trim())
                onClose()
              } catch (e) {
                setError(messageFor(e))
              } finally {
                setSaving(false)
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {signed ? (
          <fieldset className="flex gap-4 text-sm">
            <legend className="mb-1 font-medium">Direction</legend>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="direction" checked={direction === 1} onChange={() => setDirection(1)} /> The person owes the shop more
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="direction" checked={direction === -1} onChange={() => setDirection(-1)} /> The person owes the shop less
            </label>
          </fieldset>
        ) : null}
        <Field label="Amount" required>
          <MoneyInput value={amount} onValueChange={setAmount} />
        </Field>
        <Field label={noteRequired ? 'Why' : 'Note'} required={noteRequired}>
          <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error ? <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
      </div>
    </Dialog>
  )
}
