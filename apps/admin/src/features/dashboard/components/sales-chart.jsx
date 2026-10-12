import { formatMoney } from '@noor/i18n/format'
import { Card } from '@noor/ui/card'
import { ErrorState } from '@noor/ui/error-state'
import { Skeleton } from '@noor/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { dashboardQueries } from '../api'

const rupees = (/** @type {import('@noor/contract').Money} */ m) => formatMoney(m, 'en', { showDecimals: false, rounding: 'none' })
const dayText = (/** @type {string} */ day) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))

/**
 * Net sales for each day (or week) as bars drawn in SVG, one colour (plan/07-admin/02-dashboard.md section 5). A bar can be focused and says its day, its sales and its orders; a table of the same figures follows for a screen reader.
 * The heights only scale the API's figures to the picture.
 * @param {{ from: string; to: string }} props
 */
export function SalesChart({ from, to }) {
  const q = useQuery(dashboardQueries.summary(from, to))
  const [active, setActive] = useState(/** @type {number | null} */ (null))
  if (q.isPending) return <Skeleton className="h-64 w-full" />
  if (q.isError) return <ErrorState title="The chart could not be loaded" retryLabel="Try again" onRetry={() => void q.refetch()} />
  const rows = q.data.byDay
  const weekly = q.data.bucket === 'week'
  const max = Math.max(1, ...rows.map((r) => r.sales.amount))
  const w = 600
  const h = 200
  const slot = w / Math.max(rows.length, 1)
  const label = (/** @type {typeof rows[number]} */ r) => `${weekly ? 'Week of ' : ''}${dayText(r.day)}: ${rupees(r.sales)}, ${r.orders === 1 ? '1 order' : `${r.orders} orders`}`
  const shown = active !== null ? rows[active] : undefined
  return (
    <Card render={<section aria-labelledby="sales-h" />} className="space-y-3">
      <h2 id="sales-h" className="font-heading text-lg font-semibold">
        Sales by {weekly ? 'week' : 'day'}
      </h2>
      <p className="min-h-5 text-sm" aria-live="polite">
        {shown ? label(shown) : 'Point at a bar, or move to it with the Tab key.'}
      </p>
      <svg viewBox={`0 0 ${w} ${h + 4}`} role="group" aria-label={`Net sales by ${weekly ? 'week' : 'day'}`} className="h-48 w-full">
        <line x1="0" x2={w} y1={h} y2={h} className="stroke-line" />
        {rows.map((r, i) => {
          const bar = Math.max(r.sales.amount > 0 ? 2 : 0, (r.sales.amount / max) * (h - 8))
          return (
            <rect
              key={r.day}
              x={i * slot + slot * 0.12}
              width={slot * 0.76}
              y={h - bar}
              height={bar}
              rx="2"
              tabIndex={0}
              role="img"
              aria-label={label(r)}
              className={`cursor-default fill-accent outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus ${active === i ? 'opacity-70' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            />
          )
        })}
      </svg>
      <table className="sr-only">
        <caption>Net sales by {weekly ? 'week' : 'day'}</caption>
        <thead>
          <tr>
            <th scope="col">{weekly ? 'Week of' : 'Day'}</th>
            <th scope="col">Net sales</th>
            <th scope="col">Orders</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.day}>
              <th scope="row">{dayText(r.day)}</th>
              <td>{rupees(r.sales)}</td>
              <td>{r.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
