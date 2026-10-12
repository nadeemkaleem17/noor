import { Button } from '@noor/ui/button'
import { Dialog } from '@noor/ui/dialog'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { useToast } from '@noor/ui/toast'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { FormError } from '@/components/form-error'
import { api } from '@/lib/api'
import { downloadBlob } from '@/lib/download'
import { parseListParams } from '@/lib/list-params'
import { useStepUp, wasCancelled } from '@/lib/step-up'
import { orderListSchema } from '../api'

/** @param {Date} d */
const day = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * The orders placed between two days, as a CSV file (plan/07-admin/14-tables-bulk.md): the filters of the list apply too, and the person's password is asked again.
 * @param {{ open: boolean; onClose: () => void }} props
 */
export function ExportDialog({ open, onClose }) {
  const [search] = useSearchParams()
  const toast = useToast()
  const { run, dialog } = useStepUp()
  const today = new Date()
  const [from, setFrom] = useState(day(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)))
  const [to, setTo] = useState(day(today))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(/** @type {unknown} */ (null))

  async function download() {
    setBusy(true)
    setError(null)
    try {
      // the filters of the list on screen (without paging and sorting), and the range chosen here
      const filters = Object.fromEntries(Object.entries(/** @type {Record<string, unknown>} */ (parseListParams(orderListSchema, search))).filter(([k]) => !['page', 'size', 'sort'].includes(k)))
      const file = await run(() =>
        api('admin.orders.export', { body: /** @type {never} */ ({ ...filters, from: new Date(`${from}T00:00:00+05:00`).toISOString(), to: new Date(`${to}T23:59:59+05:00`).toISOString() }) }),
      )
      downloadBlob(file.filename, new Blob([file.csv], { type: 'text/csv;charset=utf-8' }))
      toast.push({ title: `${file.rowCount} orders exported`, tone: 'success' })
      onClose()
    } catch (e) {
      if (!wasCancelled(e)) setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => !o && onClose()}
        title="Export orders"
        description="Orders placed in this range, up to 5,000, with the filters of the list."
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={busy} disabled={!from || !to || from > to} onClick={() => void download()}>
              Download CSV
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="From" required>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To" required>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <FormError error={error} />
      </Dialog>
      {dialog}
    </>
  )
}
