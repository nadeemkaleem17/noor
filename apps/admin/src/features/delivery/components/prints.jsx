import { formatMoney } from '@noor/i18n/format'
import { Button } from '@noor/ui/button'
import { ErrorState } from '@noor/ui/error-state'
import { Spinner } from '@noor/ui/spinner'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useParams } from 'react-router'
import { formatDateTime } from '@/lib/dates'
import { deliveryQueries } from '../api'

const rupees = (/** @type {{ amount: number }} */ m) => formatMoney({ amount: m.amount, currency: 'PKR' }, 'en')

/** The bar on the screen (not on paper) and the wait/failure states around a printout. @param {{ title: string; ready: boolean; pending: boolean; failed: boolean; children: import('react').ReactNode; page: string }} props */
function Sheet({ title, ready, pending, failed, children, page }) {
  useEffect(() => {
    document.title = title
  }, [title])
  return (
    <div className="min-h-dvh bg-surface-2 p-4 print:bg-white print:p-0">
      <style>{`@page { size: ${page}; margin: 8mm }`}</style>
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between gap-3 print:hidden">
        <h1 className="font-heading text-lg font-semibold">{title}</h1>
        <Button disabled={!ready} onClick={() => window.print()}>
          Print
        </Button>
      </div>
      {pending ? (
        <div className="grid place-items-center p-8 print:hidden">
          <Spinner label="Loading" />
        </div>
      ) : null}
      {failed ? <ErrorState title="This could not be loaded" body="Check that you may see it, then try again." /> : null}
      {children}
    </div>
  )
}

/** `/delivery/receipts/:id/print`: one receipt on A5, ready for a signature. Everything on it is React text. */
export function ReceiptPrint() {
  const { id = '' } = useParams()
  const q = useQuery({ ...deliveryQueries.receipt(id), retry: false })
  const r = q.data
  return (
    <Sheet title={r ? `Receipt ${r.number}` : 'Receipt'} ready={q.isSuccess} pending={q.isPending} failed={q.isError} page="A5">
      {r ? (
        <article className="mx-auto w-[148mm] bg-white p-6 text-sm text-black shadow print:w-auto print:p-0 print:shadow-none">
          <header className="flex items-start justify-between gap-4 border-b border-black pb-3">
            <div>
              <h2 className="text-lg font-bold">{r.shop.name}</h2>
              {r.shop.address ? <p>{r.shop.address}</p> : null}
              {r.shop.phone ? <p dir="ltr">{r.shop.phone}</p> : null}
            </div>
            <div className="text-end">
              <p className="text-lg font-bold">{r.kind === 'customer' ? 'Receipt' : r.kind === 'deposit' ? 'Cash received from rider' : 'Fee paid to rider'}</p>
              <p className="font-bold">{r.number}</p>
              <p>{formatDateTime(r.issuedAt)}</p>
            </div>
          </header>
          {r.status === 'void' ? <p className="my-3 border-2 border-black p-2 text-center text-lg font-bold">VOID{r.voidReason ? `: ${r.voidReason}` : ''}</p> : null}
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 py-4">
            {r.kind === 'customer' ? (
              <>
                <dt className="font-bold">Received from</dt>
                <dd>{r.customerName}</dd>
                <dt className="font-bold">For order</dt>
                <dd>{r.orderNumber}</dd>
                <dt className="font-bold">Collected by</dt>
                <dd>{r.personName}</dd>
              </>
            ) : (
              <>
                <dt className="font-bold">{r.kind === 'deposit' ? 'Received from' : 'Paid to'}</dt>
                <dd>{r.personName}</dd>
              </>
            )}
            <dt className="font-bold">Amount</dt>
            <dd className="text-xl font-bold">{rupees(r.amount)}</dd>
          </dl>
          <footer className="mt-10 grid grid-cols-2 gap-8 pt-6 text-xs">
            <p className="border-t border-black pt-1">Received by {r.issuedBy ?? 'the shop'}</p>
            <p className="border-t border-black pt-1">Signature of {r.kind === 'customer' ? 'the customer' : r.personName}</p>
          </footer>
        </article>
      ) : null}
    </Sheet>
  )
}

/** `/delivery/runs/:id/print`: the sheet the rider takes: each order with the customer, phone, address and the cash to collect, and a box to tick. */
export function RunPrint() {
  const { id = '' } = useParams()
  const q = useQuery({ ...deliveryQueries.run(id), retry: false })
  const run = q.data
  return (
    <Sheet title={run ? `Delivery sheet ${run.number}` : 'Delivery sheet'} ready={q.isSuccess} pending={q.isPending} failed={q.isError} page="A4 landscape">
      {run ? (
        <article className="mx-auto max-w-4xl bg-white p-6 text-sm text-black shadow print:max-w-none print:p-0 print:shadow-none">
          <header className="mb-4 flex items-start justify-between gap-4 border-b border-black pb-3">
            <div>
              <h2 className="text-lg font-bold">{run.shop.name}: delivery sheet</h2>
              <p>
                {run.number} · {run.runDate} · {run.personName}
              </p>
            </div>
            <p className="text-end">
              {run.orders === 1 ? '1 order' : `${run.orders} orders`}
              <br />
              <span className="text-lg font-bold">To collect {rupees(run.cashDue)}</span>
            </p>
          </header>
          <table className="w-full border-collapse text-start">
            <thead>
              <tr className="border-b border-black text-start">
                <th className="p-1 text-start">Order</th>
                <th className="p-1 text-start">Customer</th>
                <th className="p-1 text-start">Address</th>
                <th className="p-1 text-end">Collect</th>
                <th className="p-1 text-start">Done</th>
              </tr>
            </thead>
            <tbody>
              {run.assignments.map((a) => (
                <tr key={a.id} className="border-b border-black/40 align-top">
                  <td className="p-1 font-bold">{a.orderNumber}</td>
                  <td className="p-1">
                    {a.customerName}
                    <br />
                    <span dir="ltr">{a.phone}</span>
                  </td>
                  <td className="p-1">
                    {a.address}, {a.city}
                  </td>
                  <td className="p-1 text-end font-bold">{a.cashDue.amount > 0 ? rupees(a.cashDue) : 'Paid'}</td>
                  <td className="p-1">
                    <span className="inline-block size-5 border border-black" aria-hidden="true" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <footer className="mt-10 grid grid-cols-2 gap-8 text-xs">
            <p className="border-t border-black pt-1">Handed over by the shop</p>
            <p className="border-t border-black pt-1">Received by {run.personName}</p>
          </footer>
        </article>
      ) : null}
    </Sheet>
  )
}
