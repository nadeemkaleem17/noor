import { formatMoney } from '@noor/i18n/format'
import { Card } from '@noor/ui/card'
import { ErrorState } from '@noor/ui/error-state'
import { Skeleton } from '@noor/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { dashboardQueries } from '../api'
import { change } from '../period'

const rupees = (/** @type {import('@noor/contract').Money} */ m) => formatMoney(m, 'en', { showDecimals: false, rounding: 'none' })
const percent = (/** @type {number | undefined} */ r) => (r === undefined ? '–' : `${Math.round(r * 100)}%`)
const reasonGroups = /** @type {Record<string, string>} */ ({ customer_request: 'customer cancelled', unreachable: 'unreachable at confirmation', refused_at_door: 'refused at the door' })

/** The arrow and the percent against the period before, in words for a screen reader too. @param {{ current: number; previous: number }} props */
function Delta({ current, previous }) {
  const d = change(current, previous)
  if (!d) return <span className="text-xs text-muted">No earlier period to compare</span>
  const word = d.dir === 'up' ? 'up' : d.dir === 'down' ? 'down' : 'no change'
  return (
    <span className={`text-xs ${d.dir === 'up' ? 'text-success' : d.dir === 'down' ? 'text-danger' : 'text-muted'}`}>
      <span aria-hidden>{d.dir === 'up' ? '▲' : d.dir === 'down' ? '▼' : '='} {d.pct}%</span>
      <span className="sr-only">{d.dir === 'same' ? word : `${word} ${d.pct} percent`} on the period before</span>
    </span>
  )
}

/** @param {{ label: string; value: string; note: string; children?: import('react').ReactNode }} props */
function Tile({ label, value, note, children }) {
  return (
    <Card padding="md" render={<li />} className="@container space-y-1">
      <p className="text-sm text-muted">{label}</p>
      {/* a figure is as large as the tile lets it be: a digit is about half an em wide, so Rs 12,345,678 shrinks instead of running out of its card (five tiles share a row on a laptop) */}
      <p className="text-2xl font-semibold tabular-nums" style={{ fontSize: `min(var(--text-2xl, 1.5rem), ${(190 / Math.max(value.length, 1)).toFixed(1)}cqw)` }}>{value}</p>
      {children}
      <p className="text-xs text-muted">{note}</p>
    </Card>
  )
}

/** The five figures of the period (plan/07-admin/02-dashboard.md section 4), as the API worked them out. @param {{ from: string; to: string; includesToday: boolean }} props */
export function KpiTiles({ from, to, includesToday }) {
  const q = useQuery(dashboardQueries.summary(from, to))
  if (q.isPending)
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    )
  if (q.isError) return <ErrorState title="The figures could not be loaded" retryLabel="Try again" onRetry={() => void q.refetch()} />
  const { current: c, previous: p } = q.data
  const reasons = Object.entries(c.cancelledByReason ?? {})
  return (
    <section aria-label="Figures of the period">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Net sales" value={rupees(c.netSales)} note={includesToday ? 'Orders placed, not yet delivered included. Today so far.' : 'Orders placed, not yet delivered included.'}>
          <Delta current={c.netSales.amount} previous={p.netSales.amount} />
        </Tile>
        <Tile label="Orders" value={String(c.orders)} note="Placed in the period, cancelled ones left out.">
          <Delta current={c.orders} previous={p.orders} />
        </Tile>
        <Tile label="Average order" value={c.averageOrder ? rupees(c.averageOrder) : '–'} note="Net sales divided by orders.">
          {c.averageOrder && p.averageOrder ? <Delta current={c.averageOrder.amount} previous={p.averageOrder.amount} /> : null}
        </Tile>
        <Tile label="Delivered rate" value={percent(c.deliveredRate)} note="Of the orders that reached a final status. Shown from 20 orders." />
        <Tile label="Cancelled / refused" value={percent(c.cancelledRate)} note={reasons.length ? reasons.map(([r, n]) => `${n} ${reasonGroups[r] ?? r.replace(/_/g, ' ')}`).join(', ') : 'Of the orders that reached a final status. Shown from 20 orders.'} />
      </ul>
    </section>
  )
}
