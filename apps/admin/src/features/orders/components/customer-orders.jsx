import { formatMoney } from '@noor/i18n/format'
import { StatusBadge } from '@noor/ui/badge'
import { Card } from '@noor/ui/card'
import { Skeleton } from '@noor/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { AppLink } from '@/components/app-link'
import { formatDateTime, relativeTime } from '@/lib/dates'
import { orderQueries } from '../api'

/** The orders of one customer, newest first, linking to the order screen. The customer screen shows it, composed in the route. @param {{ customerId: string }} props */
export function CustomerOrders({ customerId }) {
  const orders = useQuery(orderQueries.list({ customerId, size: 25, page: 1, sort: '-placedAt' }))
  return (
    <Card render={<section aria-label="Orders" />} className="space-y-3">
      <h2 className="font-heading text-lg font-semibold">Orders</h2>
      {orders.isPending ? <Skeleton className="h-16 w-full" /> : null}
      {orders.isError ? <p className="text-sm text-danger">The orders could not be loaded.</p> : null}
      {orders.isSuccess && orders.data.items.length === 0 ? <p className="text-sm text-muted">No orders yet.</p> : null}
      {orders.isSuccess && orders.data.items.length > 0 ? (
        <ul className="divide-y divide-line text-sm">
          {orders.data.items.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <AppLink to={`/orders/${o.id}`}>{o.orderNumber}</AppLink>
                <span className="ms-2 text-muted" title={formatDateTime(o.placedAt)}>
                  {relativeTime(o.placedAt)}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <StatusBadge status={o.status} />
                <span className="tabular-nums">{formatMoney(o.total, 'en')}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}
