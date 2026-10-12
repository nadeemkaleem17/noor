import { formatMoney } from '@noor/i18n/format'
import { Button } from '@noor/ui/button'
import { ErrorState } from '@noor/ui/error-state'
import { Spinner } from '@noor/ui/spinner'
import { useQueries } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { formatDateTime } from '@/lib/dates'
import { orderQueries } from '../api'
import { code128 } from '../barcode'

const rupees = (/** @type {{ amount: number }} */ m) => formatMoney({ amount: m.amount, currency: 'PKR' }, 'en')

/** The order number as a Code 128 barcode, drawn as SVG rectangles with a quiet zone either side. @param {{ value: string }} props */
export function Barcode({ value }) {
  const { bars, width } = code128(value)
  const quiet = 10
  return (
    <svg role="img" aria-label={`Barcode of ${value}`} viewBox={`0 0 ${width + quiet * 2} 40`} className="h-12 w-56" preserveAspectRatio="none" shapeRendering="crispEdges">
      <rect width={width + quiet * 2} height="40" fill="#fff" />
      {bars.map((b) => (
        <rect key={b.x} x={b.x + quiet} width={b.width} height="40" fill="#000" />
      ))}
    </svg>
  )
}

/** One invoice and packing slip, A5 (plan/07-admin/05-orders.md section 5.2). Every customer-written value is React text, so nothing in it can become markup. @param {{ data: import('@noor/contract').z.infer<typeof import('@noor/contract').InvoiceData> }} props */
function Invoice({ data }) {
  const t = data.totals
  return (
    <article className="invoice mx-auto mb-6 w-[148mm] bg-white p-6 text-sm text-black shadow print:mb-0 print:w-auto print:break-after-page print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-4 border-b border-black pb-3">
        <div>
          <h2 className="text-lg font-bold">{data.store.name}</h2>
          {data.store.address ? <p>{data.store.address}</p> : null}
          <p>{[data.store.phone, data.store.email].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="text-end">
          <p className="font-bold">{data.invoiceNumber ? `Invoice ${data.invoiceNumber}` : 'Order slip'}</p>
          <p>Order {data.orderNumber}</p>
          <p>{formatDateTime(data.dispatchedAt ?? data.placedAt)}</p>
        </div>
      </header>
      <section className="grid grid-cols-2 gap-4 py-3">
        <div>
          <h3 className="font-bold">Deliver to</h3>
          <p>{data.customer.name}</p>
          <p dir="ltr">{data.customer.phone}</p>
          <p className="whitespace-pre-wrap">{data.shippingAddress.address}</p>
          <p>{data.shippingAddress.city}{data.shippingAddress.landmark ? ` · near ${data.shippingAddress.landmark}` : ''}</p>
        </div>
        {data.courier ? (
          <div>
            <h3 className="font-bold">Courier</h3>
            <p>{data.courier}</p>
            {data.trackingNumber ? <p dir="ltr">{data.trackingNumber}</p> : null}
          </div>
        ) : null}
      </section>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-black text-start">
            <th className="py-1 text-start">Item</th>
            <th className="py-1 text-end">Qty</th>
            <th className="py-1 text-end">Price</th>
            <th className="py-1 text-end">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={i} className="border-b border-gray-300 align-top">
              <td className="py-1">
                {l.title}
                <span className="block text-xs">{l.variantLabel} · <span dir="ltr">{l.sku}</span></span>
                {l.customizationSummary ? <span className="block text-xs">{l.customizationSummary}</span> : null}
              </td>
              <td className="py-1 text-end tabular-nums">{l.quantity}</td>
              <td className="py-1 text-end tabular-nums">{rupees(l.unitPrice)}</td>
              <td className="py-1 text-end tabular-nums">{rupees(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ms-auto mt-3 w-64 space-y-0.5">
        <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{rupees(t.subtotal)}</dd></div>
        {t.discount.amount > 0 ? <div className="flex justify-between"><dt>Discount</dt><dd className="tabular-nums">−{rupees(t.discount)}</dd></div> : null}
        <div className="flex justify-between"><dt>Delivery</dt><dd className="tabular-nums">{rupees(t.shippingFee)}</dd></div>
        <div className="flex justify-between font-bold"><dt>Total</dt><dd className="tabular-nums">{rupees(t.total)}</dd></div>
        {data.paid.amount > 0 ? <div className="flex justify-between"><dt>Paid</dt><dd className="tabular-nums">{rupees(data.paid)}</dd></div> : null}
      </dl>
      <p className="mt-3 border-2 border-black p-2 text-center text-base font-bold">
        {data.paymentMethod === 'cod' ? 'Cash to collect' : 'Amount to collect'}: {rupees(data.amountToCollect)}
      </p>
      <div className="mt-3 flex justify-center">
        <Barcode value={data.orderNumber} />
      </div>
    </article>
  )
}

/**
 * `/orders/:id/print` and `/orders/print?ids=a,b`: invoices as plain pages that print on A5, one per page (plan/07-admin/05-orders.md section 5.2).
 * The screen has one bar with a Print button; the print itself shows only the invoices.
 */
export function OrderPrint() {
  const { id } = useParams()
  const [search] = useSearchParams()
  const ids = id ? [id] : (search.get('ids') ?? '').split(',').filter(Boolean).slice(0, 100)
  const results = useQueries({ queries: ids.map((i) => ({ ...orderQueries.invoice(i), staleTime: 60_000, retry: false })) })
  const ready = results.length > 0 && results.every((r) => r.isSuccess)
  useEffect(() => {
    document.title = ids.length === 1 ? 'Invoice' : 'Invoices'
  }, [ids.length])
  return (
    <div className="min-h-dvh bg-surface-2 p-4 print:bg-white print:p-0">
      <style>{'@page { size: A5; margin: 8mm }'}</style>
      <div className="mx-auto mb-4 flex max-w-[148mm] items-center justify-between gap-3 print:hidden">
        <h1 className="font-heading text-lg font-semibold">{ids.length === 1 ? 'Invoice' : `${ids.length} invoices`}</h1>
        <Button disabled={!ready} onClick={() => window.print()}>
          Print
        </Button>
      </div>
      {ids.length === 0 ? <ErrorState title="Nothing to print" body="Open this page from an order or from the selection on the orders list." /> : null}
      {results.some((r) => r.isPending) ? (
        <div className="grid place-items-center p-8 print:hidden">
          <Spinner label="Loading" />
        </div>
      ) : null}
      {results.map((r, i) =>
        r.isSuccess ? <Invoice key={ids[i]} data={r.data} /> : r.isError ? <p key={ids[i]} role="alert" className="mx-auto mb-4 max-w-[148mm] rounded-control bg-danger-soft p-3 text-sm text-danger print:hidden">Order {ids[i]} could not be loaded.</p> : null,
      )}
    </div>
  )
}
