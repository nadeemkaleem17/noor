import { formatMoney } from '@noor/i18n/format'
import { Badge } from '@noor/ui/badge'
import { Card } from '@noor/ui/card'
import { useQuery } from '@tanstack/react-query'
import { AppLink } from '@/components/app-link'
import { formatDateTime } from '@/lib/dates'
import { useCan } from '@/lib/session'
import { deliveryQueries } from '../api'
import { stateText } from './run-page'

/** The delivery history of one order, for its page: every time it was on a run, who had it, what happened, the cash and the receipt. Nothing at all for an order that never was. @param {{ orderId: string }} props */
export function OrderDeliveryPanel({ orderId }) {
  const can = useCan()
  const q = useQuery({ ...deliveryQueries.ofOrder(orderId), enabled: can('deliveries:read') })
  const items = q.data?.items ?? []
  if (!items.length) return null
  return (
    <Card render={<section aria-label="Delivery assignment" />} className="space-y-3">
      <h2 className="font-heading text-lg font-semibold">Delivery person</h2>
      <ul className="divide-y divide-line text-sm">
        {items.map((a) => (
          <li key={a.id} className="space-y-1 py-2 first:pt-0 last:pb-0">
            <p className="flex flex-wrap items-center gap-2">
              <AppLink to={`/delivery/runs/${a.runId}`} className="font-medium text-accent-text hover:underline">
                {a.runNumber}
              </AppLink>
              <span>{a.personName}</span>
              <Badge tone={a.status === 'delivered' ? 'success' : a.status === 'failed' ? 'warning' : 'neutral'}>{stateText[a.status]}</Badge>
            </p>
            <p className="text-muted">
              Given {formatDateTime(a.assignedAt)}
              {a.cashDue.amount > 0 ? ` · cash to collect ${formatMoney({ amount: a.cashDue.amount, currency: 'PKR' }, 'en')}` : ' · paid in advance'}
              {a.failReason ? ` · ${a.failReason}` : ''}
            </p>
            {a.receiptNumber && a.receiptId ? (
              <AppLink to={`/delivery/receipts/${a.receiptId}/print`} className="text-accent-text underline">
                Receipt {a.receiptNumber}
              </AppLink>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  )
}
