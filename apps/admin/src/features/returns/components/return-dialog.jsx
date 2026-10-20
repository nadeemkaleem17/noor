import { Button } from '@noor/ui/button'
import { Dialog } from '@noor/ui/dialog'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { MoneyInput } from '@noor/ui/money-input'
import { useState } from 'react'
import { messageFor } from '@/lib/errors'
import { useReturnUpdate } from '../api'
import { stepText } from '../text'

/**
 * One step of a request. Declining needs the words the customer will read; approving may name a pickup day; the end may write down a refund (the payment itself is recorded on the order).
 * @param {{ request: import('../api').ReturnRow; to: 'approved' | 'declined' | 'received' | 'completed'; onClose: () => void }} props
 */
export function ReturnDialog({ request, to, onClose }) {
  const update = useReturnUpdate()
  const [note, setNote] = useState('')
  const [pickupOn, setPickupOn] = useState('')
  const [refund, setRefund] = useState(/** @type {import('@noor/contract').Money | null} */ (null))
  const [error, setError] = useState('')
  const valid = to !== 'declined' || note.trim().length > 0
  const refundable = to === 'completed' && request.kind === 'return'
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${stepText[to]}: ${request.number}`}
      description={`${request.orderNumber} · ${request.customerName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant={to === 'declined' ? 'danger' : 'primary'}
            loading={update.isPending}
            disabled={!valid}
            onClick={async () => {
              setError('')
              try {
                await update.mutateAsync({
                  id: request.id,
                  body: { status: to, ...(note.trim() ? { decisionNote: note.trim() } : {}), ...(to === 'approved' && pickupOn ? { pickupOn } : {}), ...(refundable && refund ? { refund: refund.amount } : {}) },
                })
                onClose()
              } catch (e) {
                setError(messageFor(e))
              }
            }}
          >
            {stepText[to]}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={to === 'declined' ? 'Why (the customer reads this)' : 'Note for the customer'} required={to === 'declined'}>
          <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {to === 'approved' ? (
          <Field label="Pickup day" hint="Optional. The customer sees it on their order page.">
            <Input type="date" value={pickupOn} onChange={(e) => setPickupOn(e.target.value)} />
          </Field>
        ) : null}
        {refundable ? (
          <Field label="Refund" hint={`Written down here only. Record the payment on the order. Order total: Rs ${Math.round(request.orderTotal.amount / 100).toLocaleString('en')}.`}>
            <MoneyInput value={refund} onValueChange={setRefund} />
          </Field>
        ) : null}
        {error ? <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
      </div>
    </Dialog>
  )
}
