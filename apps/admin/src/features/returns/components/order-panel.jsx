import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useCan } from '@/lib/session'
import { returnQueries } from '../api'
import { ReturnCard } from './returns-page'
import { ReturnDialog } from './return-dialog'

/** The requests made about one order, on its screen (composed by the route: a feature does not import another). Nothing is shown when there are none. @param {{ orderId: string }} props */
export function OrderReturnsPanel({ orderId }) {
  const can = useCan()
  const list = useQuery(returnQueries.list({ orderId }))
  const [step, setStep] = useState(/** @type {{ request: import('../api').ReturnRow; to: 'approved' | 'declined' | 'received' | 'completed' } | null} */ (null))
  if (!list.data || list.data.items.length === 0) return null
  return (
    <section aria-labelledby="order-returns" className="rounded-card border border-line bg-surface p-4">
      <h2 id="order-returns" className="mb-3 font-medium">Return and exchange requests</h2>
      <ul className="flex flex-col gap-3">
        {list.data.items.map((r) => (
          <ReturnCard key={r.id} request={r} canDecide={can('orders:return')} onStep={(to) => setStep({ request: r, to })} />
        ))}
      </ul>
      {step ? <ReturnDialog request={step.request} to={step.to} onClose={() => setStep(null)} /> : null}
    </section>
  )
}
