import { Button } from '@noor/ui/button'
import { Dialog } from '@noor/ui/dialog'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { useState } from 'react'
import { rejectReasons } from '../labels'

/**
 * A rejection always has a reason, one of the listed ones (plan/07-admin/08-reviews.md section 3). The reason is for the team: the customer does not see it.
 * @param {{ title: string; withNote?: boolean; pending?: boolean; error?: import('react').ReactNode; onSubmit: (v: { reason: string; note?: string }) => void; onClose: () => void }} props
 */
export function RejectDialog({ title, withNote = true, pending = false, error, onSubmit, onClose }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description="Reject only for one of the reasons below. A low rating alone is not a reason."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={pending} disabled={!reason} onClick={() => onSubmit({ reason, ...(note.trim() ? { note: note.trim() } : {}) })}>
            Reject
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Reason" required>
          <NativeSelect options={[{ value: '', label: 'Choose a reason' }, ...rejectReasons.map(([value, label]) => ({ value, label }))]} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {withNote ? (
          <Field label="Note" hint="For the team only.">
            <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
          </Field>
        ) : null}
        {error}
      </div>
    </Dialog>
  )
}
