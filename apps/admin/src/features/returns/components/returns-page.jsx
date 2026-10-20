import { Badge } from '@noor/ui/badge'
import { Button } from '@noor/ui/button'
import { EmptyState } from '@noor/ui/empty-state'
import { ErrorState } from '@noor/ui/error-state'
import { Spinner } from '@noor/ui/spinner'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { AppLink } from '@/components/app-link'
import { PageHeader } from '@/components/page-header'
import { useCan } from '@/lib/session'
import { returnQueries } from '../api'
import { kindText, reasonText, statusText, statusTone, stepText } from '../text'
import { ReturnDialog } from './return-dialog'

const tabs = /** @type {const} */ (['requested', 'approved', 'received', 'completed', 'declined'])

/** @param {{ amount: number }} m */
const rupees = (m) => `Rs ${Math.round(m.amount / 100).toLocaleString('en')}`
/** @param {string} iso */
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

/**
 * One request: what was asked, what it is worth, and the next steps staff may take (the API lists them in `next`, the buttons only follow). Deciding does not change the order or the stock:
 * the order's own screen does that.
 * @param {{ request: import('../api').ReturnRow; canDecide: boolean; onStep: (to: 'approved' | 'declined' | 'received' | 'completed') => void }} props
 */
export function ReturnCard({ request: r, canDecide, onStep }) {
  return (
    <li className="rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{r.number} · {kindText[r.kind]}</h3>
        <Badge tone={statusTone[r.status] ?? 'neutral'}>{statusText[r.status]}</Badge>
        <span className="text-sm text-muted">{day(r.requestedAt)}</span>
      </div>
      <p className="mt-1 text-sm">
        <AppLink to={`/orders/${r.orderId}`} className="underline underline-offset-4">{r.orderNumber}</AppLink> · {r.customerName} · <bdi>{r.customerPhone}</bdi>
      </p>
      <ul className="mt-2 text-sm">
        {r.lines.map((l, i) => (
          <li key={i}>{l.title}{l.variantLabel ? ` (${l.variantLabel})` : ''} × {l.quantity} <span className="text-muted">· {rupees(l.lineTotal)}</span></li>
        ))}
      </ul>
      <p className="mt-2 text-sm"><span className="text-muted">Reason:</span> {reasonText[r.reason]}{r.note ? ` · "${r.note}"` : ''}</p>
      {r.exchangeNote ? <p className="text-sm"><span className="text-muted">Wants instead:</span> {r.exchangeNote}</p> : null}
      {r.decisionNote ? <p className="text-sm"><span className="text-muted">Our note:</span> {r.decisionNote}{r.decidedBy ? ` (${r.decidedBy})` : ''}</p> : null}
      {r.pickupOn ? <p className="text-sm"><span className="text-muted">Pickup:</span> {r.pickupOn}</p> : null}
      {r.refund ? <p className="text-sm"><span className="text-muted">Refund written down:</span> {rupees(r.refund)}</p> : null}
      {canDecide && r.next.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.next.map((to) => (
            <Button key={to} size="sm" variant={to === 'declined' ? 'secondary' : 'primary'} onClick={() => onStep(/** @type {never} */ (to))}>{stepText[to]}</Button>
          ))}
        </div>
      ) : null}
    </li>
  )
}

/** `/returns`: what customers asked to return or exchange (DOC-06.14 RT-04), one tab per status. */
export function ReturnsPage() {
  const can = useCan()
  const [params, setParams] = useSearchParams()
  const status = tabs.find((t) => t === params.get('status')) ?? 'requested'
  const list = useQuery(returnQueries.list({ status }))
  const [step, setStep] = useState(/** @type {{ request: import('../api').ReturnRow; to: 'approved' | 'declined' | 'received' | 'completed' } | null} */ (null))
  return (
    <>
      <PageHeader title="Returns and exchanges" description="Requests customers send from their order page. Deciding here tells the customer; the order and stock are changed on the order itself." />
      <nav aria-label="Request status" className="mb-3 flex gap-1 overflow-x-auto pb-1">
        {tabs.map((t) => {
          const n = list.data?.counts[t]
          return (
            <button
              key={t}
              type="button"
              aria-pressed={status === t}
              onClick={() => setParams(t === 'requested' ? {} : { status: t })}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control px-3 text-sm ${status === t ? 'bg-accent text-on-accent' : 'bg-surface-2 text-fg hover:bg-line'}`}
            >
              {statusText[t]}
              {n !== undefined ? <span className={status === t ? 'opacity-80' : 'text-muted'}>{n}</span> : null}
            </button>
          )
        })}
      </nav>
      {list.isPending ? <Spinner label="Loading requests" /> : list.isError ? (
        <ErrorState title="The requests could not be loaded" retryLabel="Try again" onRetry={() => void list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="Nothing here" body={status === 'requested' ? 'No request is waiting for you.' : 'No request in this state.'} />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.data.items.map((r) => (
            <ReturnCard key={r.id} request={r} canDecide={can('orders:return')} onStep={(to) => setStep({ request: r, to })} />
          ))}
        </ul>
      )}
      {step ? <ReturnDialog request={step.request} to={step.to} onClose={() => setStep(null)} /> : null}
    </>
  )
}
