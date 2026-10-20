import { formatMoney } from '@noor/i18n/format'
import { Badge } from '@noor/ui/badge'
import { Button } from '@noor/ui/button'
import { EmptyState } from '@noor/ui/empty-state'
import { ErrorState } from '@noor/ui/error-state'
import { Input } from '@noor/ui/input'
import { Skeleton } from '@noor/ui/skeleton'
import { Table, Td, Th } from '@noor/ui/table'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Banknote, HandCoins, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { AppLink } from '@/components/app-link'
import { formatDateTime } from '@/lib/dates'
import { useCan } from '@/lib/session'
import { deliveryQueries, useLedgerMutations } from '../api'
import { CashDialog } from './cash-dialog'
import { balanceText, kindName } from './people-page'

const rupees = (/** @type {number} */ amount) => formatMoney({ amount, currency: 'PKR' }, 'en')
const kindText = /** @type {Record<string, string>} */ ({
  cash_due: 'Cash to collect',
  cash_returned: 'Parcel returned',
  deposit: 'Cash handed in',
  fee: 'Fee earned',
  fee_paid: 'Fee paid out',
  adjustment: 'Adjustment',
  reversal: 'Reversal',
})

/** `/delivery/people/:id`: one person's ledger, the cash they hold, and the three things staff can do to it (plan/18-delivery-assignment-ledger-receipts.md section 4). @param {{ id: string }} props */
export function PersonPage({ id }) {
  const can = useCan()
  const toast = useToast()
  const [search, setSearch] = useSearchParams()
  const range = { ...(search.get('from') ? { from: /** @type {string} */ (search.get('from')) } : {}), ...(search.get('to') ? { to: /** @type {string} */ (search.get('to')) } : {}) }
  const statement = useQuery(deliveryQueries.ledger(id, range))
  const { deposit, payFee, adjust } = useLedgerMutations(id)
  const [dialog, setDialog] = useState(/** @type {'deposit' | 'fee' | 'adjust' | null} */ (null))
  const s = statement.data
  const writable = can('ledger:write')
  const setRange = (/** @type {'from' | 'to'} */ key, /** @type {string} */ value) =>
    setSearch((cur) => {
      const next = new URLSearchParams(cur)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })

  if (statement.isPending) return <Skeleton className="h-96 w-full" />
  if (statement.isError || !s) return <ErrorState title="This ledger could not be loaded" retryLabel="Try again" onRetry={() => void statement.refetch()} />
  const owes = s.person.balance.amount

  return (
    <>
      <header className="mb-4 space-y-2">
        <AppLink to="/delivery/people" className="inline-flex items-center gap-1 text-sm text-accent-text">
          <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" /> Delivery people
        </AppLink>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="font-heading text-2xl font-semibold">{s.person.name}</h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>{kindName[s.person.kind]}</span>
              <span dir="ltr">{s.person.phone}</span>
              {s.person.active ? <Badge tone="success">Active</Badge> : <Badge>Not active</Badge>}
              <span>{s.person.ordersOut === 1 ? '1 order out' : `${s.person.ordersOut} orders out`}</span>
            </p>
          </div>
          {writable ? (
            <div className="flex flex-wrap gap-2">
              <Button iconStart={<Banknote aria-hidden className="size-4" />} onClick={() => setDialog('deposit')}>
                Record cash handed in
              </Button>
              <Button variant="secondary" iconStart={<HandCoins aria-hidden className="size-4" />} onClick={() => setDialog('fee')}>
                Pay fee
              </Button>
              <Button variant="secondary" iconStart={<SlidersHorizontal aria-hidden className="size-4" />} onClick={() => setDialog('adjust')}>
                Adjustment
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      <section aria-label="Balance" className="mb-4 rounded-card border border-line bg-surface p-4">
        <p className="text-sm text-muted">Balance now</p>
        <p className={`font-heading text-3xl font-semibold ${owes > 0 ? 'text-warning' : ''}`}>{balanceText(owes)}</p>
        <p className="text-sm text-muted">The cash of orders given to this person, less what they handed in and the fees they earned.</p>
      </section>

      <div role="search" className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          From
          <Input type="date" value={search.get('from') ?? ''} onChange={(e) => setRange('from', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          To
          <Input type="date" value={search.get('to') ?? ''} onChange={(e) => setRange('to', e.target.value)} />
        </label>
        {range.from || range.to ? (
          <Button variant="ghost" onClick={() => setSearch({})}>
            Clear dates
          </Button>
        ) : null}
      </div>

      {s.entries.length === 0 && s.opening.amount === 0 ? (
        <EmptyState title="Nothing in the ledger yet" body="Cash appears here when a run goes out with this person." />
      ) : (
        <Table label="Ledger">
          <caption className="sr-only">Ledger of {s.person.name}</caption>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>What</Th>
              <Th>Order, run, receipt</Th>
              <Th numeric>Owes more</Th>
              <Th numeric>Owes less</Th>
              <Th numeric>Balance</Th>
            </tr>
          </thead>
          <tbody>
            {range.from ? (
              <tr className="bg-surface-2">
                <Td colSpan={5}>Brought forward</Td>
                <Td numeric>{rupees(s.opening.amount)}</Td>
              </tr>
            ) : null}
            {s.entries.map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap">{formatDateTime(e.createdAt)}</Td>
                <Td>
                  {kindText[e.kind]}
                  {e.note ? <span className="block text-xs text-muted">{e.note}</span> : null}
                  {e.actor ? <span className="block text-xs text-muted">by {e.actor}</span> : null}
                </Td>
                <Td className="text-sm">
                  {[e.orderNumber, e.runNumber, e.receiptNumber].filter(Boolean).join(' · ')}
                </Td>
                <Td numeric>{e.amount.amount > 0 ? rupees(e.amount.amount) : ''}</Td>
                <Td numeric>{e.amount.amount < 0 ? rupees(-e.amount.amount) : ''}</Td>
                <Td numeric>{rupees(e.balance.amount)}</Td>
              </tr>
            ))}
            <tr className="bg-surface-2 font-medium">
              <Td colSpan={5}>{range.to ? 'Balance at the end of the period' : 'Balance now'}</Td>
              <Td numeric>{rupees(s.closing.amount)}</Td>
            </tr>
          </tbody>
        </Table>
      )}

      {dialog === 'deposit' ? (
        <CashDialog
          title="Cash handed in"
          description={`${s.person.name} gave cash to the shop. A deposit receipt is made.`}
          confirmLabel="Record and make receipt"
          onClose={() => setDialog(null)}
          onSubmit={async (amount, note) => {
            const r = await deposit.mutateAsync({ amount, ...(note ? { note } : {}) })
            toast.push({ title: `Receipt ${r.number} made`, tone: 'success', action: { label: 'Print', onClick: () => window.open(`/delivery/receipts/${r.id}/print`, '_blank', 'noopener') } })
          }}
        />
      ) : null}
      {dialog === 'fee' ? (
        <CashDialog
          title="Pay fee"
          description={`The shop pays ${s.person.name} the fees earned. A fee receipt is made.`}
          confirmLabel="Record and make receipt"
          onClose={() => setDialog(null)}
          onSubmit={async (amount, note) => {
            const r = await payFee.mutateAsync({ amount, ...(note ? { note } : {}) })
            toast.push({ title: `Receipt ${r.number} made`, tone: 'success', action: { label: 'Print', onClick: () => window.open(`/delivery/receipts/${r.id}/print`, '_blank', 'noopener') } })
          }}
        />
      ) : null}
      {dialog === 'adjust' ? (
        <CashDialog
          title="Adjustment"
          description="A correction that is not cash handed in or a fee. It stays in the ledger for good; a mistake is corrected by another adjustment."
          confirmLabel="Add to the ledger"
          signed
          noteRequired
          onClose={() => setDialog(null)}
          onSubmit={async (amount, note) => {
            await adjust.mutateAsync({ amount, note })
            toast.push({ title: 'Adjustment recorded', tone: 'success' })
          }}
        />
      ) : null}
    </>
  )
}
