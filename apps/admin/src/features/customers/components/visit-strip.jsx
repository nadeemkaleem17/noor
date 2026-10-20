import { NativeSelect } from '@noor/ui/native-select'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { visitSummaryQuery } from '../api'

/** Pakistan is five hours ahead of UTC all year. @param {number} daysAgo */
const pkDay = (daysAgo) => new Date(Date.now() + 5 * 3_600_000 - daysAgo * 86_400_000).toISOString().slice(0, 10)

const periods = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

/** @param {{ label: string; value: number; note?: string }} props */
function Figure({ label, value, note }) {
  return (
    <div className="min-w-32">
      <dt className="text-sm text-muted">{label}</dt>
      <dd>
        <span className="font-heading text-2xl font-semibold">{value.toLocaleString('en')}</span>
        {note ? <span className="block text-xs text-muted">{note}</span> : null}
      </dd>
    </div>
  )
}

/** Visits to the website, counted without names: the anonymous side of the customer screens. Its own query, so the list never waits for it. */
export function VisitStrip() {
  const [days, setDays] = useState('30')
  const summary = useQuery(visitSummaryQuery({ from: pkDay(Number(days) - 1), to: pkDay(0) }))
  return (
    <section aria-label="Website visits" className="mb-4 rounded-card border border-line bg-surface p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">Website visits</h2>
        <NativeSelect aria-label="Period" value={days} onChange={(e) => setDays(e.target.value)} options={periods} />
      </header>
      {summary.isPending ? <p className="text-sm text-muted">Loading…</p> : null}
      {summary.isError ? <p className="text-sm text-danger">Visits could not be loaded.</p> : null}
      {summary.data ? (
        <>
          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            <Figure label="Visits" value={summary.data.visits} />
            <Figure label="Visitors" value={summary.data.visitors} note="Browsers, not people" />
            <Figure label="New" value={summary.data.newVisitors} note="First visit in this period" />
            <Figure label="Returning" value={summary.data.returningVisitors} note="Had come before" />
            <Figure label="Became customers" value={summary.data.identifiedVisitors} note="Ordered from that browser" />
          </dl>
          {summary.data.topPages.length > 0 ? (
            <p className="mt-3 text-sm text-muted">
              Most visits began on: {summary.data.topPages.slice(0, 5).map((p) => `${p.path} (${p.visits})`).join(', ')}
            </p>
          ) : null}
          {summary.data.visits === 0 ? <p className="mt-3 text-sm text-muted">No visits counted yet. Visits are counted while Store settings → Features → Count visits is on.</p> : null}
        </>
      ) : null}
    </section>
  )
}
