import { Button } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { Dialog } from '@noor/ui/dialog'
import { Field } from '@noor/ui/field'
import { NativeSelect } from '@noor/ui/native-select'
import { Textarea } from '@noor/ui/textarea'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FormError } from '@/components/form-error'
import { api } from '@/lib/api'
import { orderQueries } from '../api'

/**
 * Reads the pasted tracking list, one order per line: the number, then the tracking number, split by a comma, a tab or spaces.
 * @param {string} text
 * @returns {{ rows: { orderNumber: string; trackingNumber: string }[]; bad: string[] }}
 */
export function parseTracking(text) {
  /** @type {{ orderNumber: string; trackingNumber: string }[]} */
  const rows = []
  /** @type {string[]} */
  const bad = []
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const [orderNumber, ...rest] = line.split(/[\t, ]+/)
    const trackingNumber = rest.join(' ').trim()
    if (orderNumber && /^RB-\d+$/i.test(orderNumber) && trackingNumber) rows.push({ orderNumber: orderNumber.toUpperCase(), trackingNumber })
    else bad.push(line)
  }
  return { rows, bad }
}

const vias = [
  { value: 'call', label: 'Called the customer' },
  { value: 'whatsapp', label: 'WhatsApp conversation' },
  { value: 'customer_message', label: 'Customer wrote to us' },
]

/**
 * The question a bulk action asks before it goes (plan/07-admin/05-orders.md sections 2 and 5.2): how the customers were reached, the courier and tracking numbers, or whether cash was received.
 * The dialog answers the table's pending action with the server's per-order result, or with "cancelled".
 * @param {{ request: { kind: 'confirm' | 'dispatch' | 'deliver'; ids: string[]; resolve: (o: import('@/components/bulk-bar').BulkOutcome) => void } | null; onClose: () => void }} props
 */
export function BulkOrderDialog({ request, onClose }) {
  const lookups = useQuery({ ...orderQueries.lookups(), enabled: request?.kind === 'dispatch' })
  const [via, setVia] = useState('call')
  const [courierId, setCourierId] = useState('')
  const [paste, setPaste] = useState('')
  const [cash, setCash] = useState(true)
  const parsed = parseTracking(paste)
  const courier = lookups.data?.couriers.find((c) => c.id === courierId)
  const run = useMutation({
    mutationFn: async () => {
      if (!request) throw new Error('no request')
      const body =
        request.kind === 'confirm'
          ? { ids: request.ids, action: /** @type {const} */ ('confirm'), params: { via: /** @type {'call' | 'whatsapp' | 'customer_message'} */ (via) } }
          : request.kind === 'dispatch'
            ? { ids: request.ids, action: /** @type {const} */ ('dispatch'), params: { courierId, ...(parsed.rows.length ? { tracking: parsed.rows } : {}) } }
            : { ids: request.ids, action: /** @type {const} */ ('deliver'), params: { cashReceived: cash } }
      return api('admin.orders.bulk', { body })
    },
    onSuccess: (result) => {
      request?.resolve(result)
      onClose()
    },
  })
  const close = () => {
    request?.resolve({ cancelled: true })
    run.reset()
    onClose()
  }
  const count = request?.ids.length ?? 0
  const title = request?.kind === 'confirm' ? `Confirm ${count} orders` : request?.kind === 'dispatch' ? `Mark ${count} orders dispatched` : `Mark ${count} orders delivered`
  const ready = request?.kind === 'dispatch' ? courierId !== '' && (!courier?.trackingRequired || parsed.rows.length > 0) && parsed.bad.length === 0 : true
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => !open && close()}
      title={title}
      description="Each order is checked on its own: the ones that cannot go are listed, the rest go."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button loading={run.isPending} disabled={!ready} onClick={() => run.mutate()}>
            {request?.kind === 'confirm' ? 'Confirm orders' : request?.kind === 'dispatch' ? 'Mark dispatched' : 'Mark delivered'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {request?.kind === 'confirm' ? (
          <Field label="How were they confirmed?" required>
            <NativeSelect options={vias} value={via} onChange={(e) => setVia(e.target.value)} />
          </Field>
        ) : null}
        {request?.kind === 'dispatch' ? (
          <>
            <Field label="Courier" required>
              <NativeSelect options={[{ value: '', label: 'Choose a courier' }, ...(lookups.data?.couriers ?? []).map((c) => ({ value: c.id, label: c.name }))]} value={courierId} onChange={(e) => setCourierId(e.target.value)} />
            </Field>
            <Field
              label="Tracking numbers"
              required={courier?.trackingRequired}
              hint="One order per line: the order number, then the tracking number (RB-10458, TCS123456)."
              error={parsed.bad.length ? `Cannot read: ${parsed.bad.slice(0, 3).join('; ')}` : undefined}
            >
              <Textarea rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} spellCheck={false} />
            </Field>
            {parsed.rows.length ? <p className="text-sm text-muted">{parsed.rows.length} tracking numbers read.</p> : null}
          </>
        ) : null}
        {request?.kind === 'deliver' ? <Checkbox label="Cash on delivery was received for these orders" checked={cash} onCheckedChange={setCash} /> : null}
        <FormError error={run.error} />
      </div>
    </Dialog>
  )
}
