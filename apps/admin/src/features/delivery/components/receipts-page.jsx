import { formatDate, formatMoney } from '@noor/i18n/format'
import { StatusBadge } from '@noor/ui/badge'
import { Button } from '@noor/ui/button'
import { Dialog } from '@noor/ui/dialog'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { Ban, Printer } from 'lucide-react'
import { useState } from 'react'
import { DataTable } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { deliveryPeopleQuery } from '@/lib/delivery'
import { messageFor } from '@/lib/errors'
import { useCan } from '@/lib/session'
import { deliveryQueries, receiptListSchema, useVoidReceipt } from '../api'

/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').ReceiptRow>} Row */

const kindText = /** @type {Record<string, string>} */ ({ customer: 'From a customer', deposit: 'Cash handed in', fee: 'Fee paid out' })
const rupees = (/** @type {{ amount: number }} */ m) => formatMoney({ amount: m.amount, currency: 'PKR' }, 'en')

/** @type {import('@/components/data-table').Column<Row>[]} */
const columns = [
  { id: 'number', header: 'Receipt', cell: (r) => <span className="font-medium">{r.number}</span> },
  { id: 'kind', header: 'Kind', cell: (r) => kindText[r.kind] },
  { id: 'personName', header: 'Delivery person', cell: (r) => r.personName },
  { id: 'orderNumber', header: 'Order', cell: (r) => r.orderNumber ?? '' },
  { id: 'amount', header: 'Amount', align: 'end', cell: (r) => rupees(r.amount) },
  { id: 'issuedAt', header: 'Made', align: 'end', cell: (r) => formatDate(r.issuedAt, 'en', { dateStyle: 'medium' }) },
  { id: 'status', header: 'Status', cell: (r) => (r.status === 'void' ? <StatusBadge status="cancelled" /> : <span>Valid</span>) },
]

/** `/delivery/receipts` (plan/18-delivery-assignment-ledger-receipts.md section 5): every receipt made, printed from here, and voided here with a reason (never deleted). */
export function ReceiptsPage() {
  const can = useCan()
  const toast = useToast()
  const people = useQuery(deliveryPeopleQuery)
  const voidReceipt = useVoidReceipt()
  const [voiding, setVoiding] = useState(/** @type {Row | null} */ (null))
  const [reason, setReason] = useState('')
  /** @type {import('@/components/list-filters').FilterDef[]} */
  const filters = [
    { key: 'kind', label: 'Kind', type: 'select', options: Object.entries(kindText).map(([value, label]) => ({ value, label })) },
    { key: 'status', label: 'Status', type: 'select', options: [{ value: 'issued', label: 'Valid' }, { value: 'void', label: 'Void' }] },
    ...(people.data ? [/** @type {const} */ ({ key: 'personId', label: 'Person', type: 'select', options: people.data.items.map((p) => ({ value: p.id, label: p.name })) })] : []),
  ]
  /** @param {Row} r */
  const rowActions = (r) => [
    { label: 'Print', icon: <Printer aria-hidden className="size-4" />, onSelect: () => void window.open(`/delivery/receipts/${r.id}/print`, '_blank', 'noopener') },
    ...(can('receipts:void') && r.status === 'issued' ? [{ label: 'Void', icon: <Ban aria-hidden className="size-4" />, tone: /** @type {const} */ ('danger'), onSelect: () => (setReason(''), setVoiding(r)) }] : []),
  ]
  return (
    <>
      <PageHeader title="Receipts" description="Made when cash is collected from a customer, handed in by a rider, or a fee is paid. A receipt is voided with a reason, never deleted." />
      <DataTable
        id="receipts"
        label="Receipts"
        schema={receiptListSchema}
        query={deliveryQueries.receipts}
        columns={columns}
        filters={filters}
        defaultSort="-issuedAt"
        rowId={(r) => r.id}
        rowLabel={(r) => r.number}
        rowHref={(r) => `/delivery/receipts/${r.id}/print`}
        rowActions={rowActions}
        empty={{ title: 'No receipts yet', body: 'A receipt is made when a delivered order\'s cash is collected, and when a rider hands cash in.' }}
      />
      <Dialog
        open={voiding !== null}
        onOpenChange={(open) => !open && setVoiding(null)}
        title={`Void ${voiding?.number ?? ''}?`}
        description="The receipt stays on record, marked void. What it put on the rider's ledger is reversed."
        footer={
          <>
            <Button variant="secondary" onClick={() => setVoiding(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={voidReceipt.isPending}
              disabled={!reason.trim()}
              onClick={() => {
                if (!voiding) return
                voidReceipt.mutate(
                  { id: voiding.id, reason: reason.trim() },
                  {
                    onSuccess: () => {
                      toast.push({ title: `${voiding.number} voided`, tone: 'success' })
                      setVoiding(null)
                    },
                    onError: (e) => toast.push({ title: messageFor(e), tone: 'danger' }),
                  },
                )
              }}
            >
              Void the receipt
            </Button>
          </>
        }
      >
        <Field label="Why" required>
          <Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Dialog>
    </>
  )
}
