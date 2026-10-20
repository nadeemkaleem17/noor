import { formatMoney } from '@noor/i18n/format'
import { Badge } from '@noor/ui/badge'
import { Button, IconButton, LinkButton } from '@noor/ui/button'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { Dialog } from '@noor/ui/dialog'
import { ErrorState } from '@noor/ui/error-state'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { Menu } from '@noor/ui/menu'
import { Skeleton } from '@noor/ui/skeleton'
import { Table, Td, Th } from '@noor/ui/table'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Ellipsis, Printer, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router'
import { AppLink } from '@/components/app-link'
import { messageFor } from '@/lib/errors'
import { useCan } from '@/lib/session'
import { deliveryQueries, useRunMutations } from '../api'
import { runStatusText, runTone } from './runs-page'

const rupees = (/** @type {{ amount: number }} */ m) => formatMoney({ amount: m.amount, currency: 'PKR' }, 'en')
const stateTone = /** @type {Record<string, 'neutral' | 'accent' | 'success' | 'warning' | 'danger'>} */ ({ assigned: 'neutral', out: 'accent', delivered: 'success', failed: 'warning', returned: 'neutral' })
export const stateText = /** @type {Record<string, string>} */ ({ assigned: 'To send out', out: 'Out', delivered: 'Delivered', failed: 'Not delivered', returned: 'Back at the shop', removed: 'Removed' })

/** What the person does with one order of a run. @typedef {{ kind: 'fail' | 'return' | 'remove' | 'deliver'; id: string; label: string; cash: number }} Pending */

/** `/delivery/runs/:id`: the orders of one run and what happened to each (plan/18-delivery-assignment-ledger-receipts.md section 4). @param {{ id: string }} props */
export function RunPage({ id }) {
  const can = useCan()
  const toast = useToast()
  const query = useQuery(deliveryQueries.run(id))
  const m = useRunMutations()
  const [pending, setPending] = useState(/** @type {Pending | null} */ (null))
  const [reason, setReason] = useState('')
  const [closing, setClosing] = useState(false)
  const run = query.data
  const writable = can('deliveries:assign')

  if (query.isPending) return <Skeleton className="h-96 w-full" />
  if (query.isError || !run) return <ErrorState title="This run could not be loaded" retryLabel="Try again" onRetry={() => void query.refetch()} />

  /** Runs a call and says what happened; the dialog stays open on a failure. @param {() => Promise<unknown>} job @param {string} done */
  const go = async (job, done) => {
    try {
      await job()
      toast.push({ title: done, tone: 'success' })
    } catch (e) {
      toast.push({ title: messageFor(e), tone: 'danger' })
      throw e
    }
  }
  const toSend = run.assignments.filter((a) => a.status === 'assigned').length
  const stillOut = run.assignments.filter((a) => a.status === 'out').length

  return (
    <>
      <header className="mb-4 space-y-2">
        <AppLink to="/delivery/runs" className="inline-flex items-center gap-1 text-sm text-accent-text">
          <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" /> Delivery runs
        </AppLink>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="flex flex-wrap items-center gap-3 font-heading text-2xl font-semibold">
              {run.number}
              <Badge tone={runTone[run.status] ?? 'neutral'}>{runStatusText[run.status]}</Badge>
            </h1>
            <p className="text-sm text-muted">
              {run.runDate} · {run.personName} · {run.orders === 1 ? '1 order' : `${run.orders} orders`} · cash to collect {rupees(run.cashDue)} · collected {rupees(run.collected)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/delivery/runs/${run.id}/print`} variant="secondary" iconStart={<Printer aria-hidden className="size-4" />} render={<RouterLink to={`/delivery/runs/${run.id}/print`} target="_blank" />}>
              Print the sheet
            </LinkButton>
            {writable && run.status === 'open' && toSend > 0 ? (
              <Button iconStart={<Truck aria-hidden className="size-4" />} loading={m.sendOut.isPending} onClick={() => void go(() => m.sendOut.mutateAsync(run.id), 'The run is out with the rider').catch(() => {})}>
                Send out
              </Button>
            ) : null}
            {writable && run.status !== 'closed' ? (
              <Button variant="secondary" disabled={stillOut > 0} onClick={() => setClosing(true)}>
                Close the run
              </Button>
            ) : null}
          </div>
        </div>
        {run.status === 'open' ? <p className="text-sm text-muted">Nothing has left the shop yet. Sending the run out dispatches each order and puts its cash on the rider's ledger.</p> : null}
      </header>

      {run.assignments.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-4 text-sm text-muted">No orders are on this run.</p>
      ) : (
        <Table label="Orders of the run">
          <caption className="sr-only">Orders of {run.number}</caption>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th>Address</Th>
              <Th numeric>Cash to collect</Th>
              <Th>State</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {run.assignments.map((a) => (
              <tr key={a.id}>
                <Td>
                  <AppLink to={`/orders/${a.orderId}`} className="font-medium hover:underline">
                    {a.orderNumber}
                  </AppLink>
                </Td>
                <Td>
                  {a.customerName}
                  <span className="block text-xs text-muted" dir="ltr">{a.phone}</span>
                </Td>
                <Td className="max-w-xs text-sm">
                  {a.address}, {a.city}
                </Td>
                <Td numeric>{a.cashDue.amount > 0 ? rupees(a.cashDue) : 'Paid'}</Td>
                <Td>
                  <Badge tone={stateTone[a.status] ?? 'neutral'}>{stateText[a.status]}</Badge>
                  {a.failReason ? <span className="block text-xs text-muted">{a.failReason}</span> : null}
                  {a.receiptNumber ? (
                    <AppLink to={`/delivery/receipts/${a.receiptId}/print`} className="block text-xs text-accent-text underline">
                      Receipt {a.receiptNumber}
                    </AppLink>
                  ) : null}
                </Td>
                <Td>
                  {writable && ['assigned', 'out', 'failed'].includes(a.status) ? (
                    <Menu
                      align="end"
                      trigger={<IconButton label={`Actions for ${a.orderNumber}`} icon={<Ellipsis aria-hidden className="size-5" />} />}
                      items={[
                        ...(a.status === 'out' || a.status === 'failed' ? [{ label: 'Delivered, cash collected', onSelect: () => setPending({ kind: 'deliver', id: a.id, label: a.orderNumber, cash: a.cashDue.amount }) }] : []),
                        ...(a.status === 'out' ? [{ label: 'Could not deliver', onSelect: () => (setReason(''), setPending({ kind: 'fail', id: a.id, label: a.orderNumber, cash: a.cashDue.amount })) }] : []),
                        ...(a.status === 'out' || a.status === 'failed' ? [{ label: 'Parcel back at the shop', onSelect: () => setPending({ kind: 'return', id: a.id, label: a.orderNumber, cash: a.cashDue.amount }) }] : []),
                        ...(a.status === 'assigned' ? [{ label: 'Take off this run', tone: /** @type {const} */ ('danger'), onSelect: () => setPending({ kind: 'remove', id: a.id, label: a.orderNumber, cash: a.cashDue.amount }) }] : []),
                      ]}
                    />
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <ConfirmDialog
        open={pending?.kind === 'deliver'}
        onOpenChange={(open) => !open && setPending(null)}
        title={`${pending?.label ?? ''} delivered?`}
        body={pending && pending.cash > 0 ? `The order is marked delivered, ${rupees({ amount: pending.cash })} counts as collected by the rider, and a customer receipt is made.` : 'The order is marked delivered.'}
        confirmLabel="Delivered"
        tone="accent"
        onConfirm={async () => {
          if (pending) await go(() => m.deliver.mutateAsync(pending.id), `${pending.label} delivered`)
        }}
      />
      <ConfirmDialog
        open={pending?.kind === 'return'}
        onOpenChange={(open) => !open && setPending(null)}
        title={`${pending?.label ?? ''} is back at the shop?`}
        body={pending && pending.cash > 0 ? `The order is returned (its stock goes back) and ${rupees({ amount: pending.cash })} is taken off what the rider owes.` : 'The order is returned and its stock goes back.'}
        confirmLabel="Returned"
        onConfirm={async () => {
          if (pending) await go(() => m.returnToShop.mutateAsync(pending.id), `${pending.label} returned`)
        }}
      />
      <ConfirmDialog
        open={pending?.kind === 'remove'}
        onOpenChange={(open) => !open && setPending(null)}
        title={`Take ${pending?.label ?? ''} off this run?`}
        body="It stays confirmed and can be given to another rider."
        confirmLabel="Take off"
        onConfirm={async () => {
          if (pending) await go(() => m.remove.mutateAsync(pending.id), `${pending.label} taken off`)
        }}
      />
      <Dialog
        open={pending?.kind === 'fail'}
        onOpenChange={(open) => !open && setPending(null)}
        title={`${pending?.label ?? ''} could not be delivered`}
        description="The cash stays on the rider until the parcel is back at the shop."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              loading={m.fail.isPending}
              disabled={!reason.trim()}
              onClick={() => {
                if (pending) void go(() => m.fail.mutateAsync({ id: pending.id, reason: reason.trim() }), `${pending.label} marked as not delivered`).then(() => setPending(null)).catch(() => {})
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <Field label="What happened" required>
          <Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Dialog>
      <ConfirmDialog
        open={closing}
        onOpenChange={setClosing}
        title={`Close ${run.number}?`}
        body={run.status === 'open' ? 'This run never went out, so closing it takes its orders off. They stay confirmed.' : 'Nothing is out with the rider. Orders that were not delivered stay on this sheet until they are returned.'}
        confirmLabel="Close the run"
        onConfirm={async () => {
          await go(() => m.close.mutateAsync(run.id), `${run.number} closed`)
        }}
      />
    </>
  )
}
