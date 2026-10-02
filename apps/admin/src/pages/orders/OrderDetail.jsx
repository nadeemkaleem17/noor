import { useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { useCollection, useSingleton } from '../../hooks/useCollection.js'
import { formatMoney, formatDateTime, formatDate } from '../../lib/format.js'
import { StatusPill, ConfirmDialog, LoadState } from '../../components/ui.jsx'
import { TextArea, TextInput, SelectInput } from '../../components/Field.jsx'
import { useToast } from '../../context/toastContext.js'
import { printInvoice } from '../../lib/invoice.js'
import { COURIERS, historyOf, transitionPatch } from '../../lib/orders.js'

const SEQUENCE = ['pending', 'confirmed', 'dispatched', 'delivered']

function OrderStepper({ status }) {
  if (status === 'cancelled' || status === 'returned') {
    const stopIndex = status === 'returned' ? SEQUENCE.indexOf('delivered') : SEQUENCE.indexOf('pending')
    return (
      <div className="stepper">
        {SEQUENCE.slice(0, stopIndex + 1).map((s) => (
          <FragmentStep key={s} label={s} done last={false} />
        ))}
        <div className="step-line done" />
        <div className="step cancelled">
          <span className="dot">✕</span>
          {status === 'returned' ? 'Returned' : 'Cancelled'}
        </div>
      </div>
    )
  }
  const currentIndex = SEQUENCE.indexOf(status)
  return (
    <div className="stepper">
      {SEQUENCE.map((s, i) => (
        <FragmentStep key={s} label={s} done={i < currentIndex} current={i === currentIndex} last={i === SEQUENCE.length - 1} />
      ))}
    </div>
  )
}

function FragmentStep({ label, done, current, last }) {
  return (
    <>
      <div className={`step${done ? ' done' : ''}${current ? ' current' : ''}`}>
        <span className="dot">{done ? '✓' : ''}</span>
        {label}
      </div>
      {!last && <div className={`step-line${done ? ' done' : ''}`} />}
    </>
  )
}

const NEXT_STATUS = {
  pending: [{ to: 'confirmed', label: 'Confirm order' }, { to: 'cancelled', label: 'Cancel order', tone: 'danger' }],
  confirmed: [{ to: 'dispatched', label: 'Mark dispatched' }, { to: 'cancelled', label: 'Cancel order', tone: 'danger' }],
  dispatched: [{ to: 'delivered', label: 'Mark delivered' }, { to: 'returned', label: 'Mark returned', tone: 'danger' }],
  delivered: [{ to: 'returned', label: 'Mark returned', tone: 'danger' }],
  cancelled: [],
  returned: [],
}

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const push = useToast()
  const { items: orders, update, status: loadStatus, retry } = useCollection('orders')
  const { value: storeConfig } = useSingleton('storeConfig')
  const order = orders.find((o) => o.id === id)
  const [notes, setNotes] = useState(order?.internalNotes || '')
  // Keyed on the order actually being present, so notes also load when the order arrives from the API after the first render.
  const notesKey = order ? id : null
  const [notesForId, setNotesForId] = useState(notesKey)
  const [pending, setPending] = useState(null) // the transition awaiting confirmation
  const [courier, setCourier] = useState(COURIERS[0])
  const [tracking, setTracking] = useState('')
  const [reason, setReason] = useState('')

  // Reset the notes draft whenever the route's order id changes, synchronously during
  // render (same pattern as ProductEditor/Settings) — fixes notes leaking between orders (F-05).
  if (notesKey !== notesForId) {
    setNotesForId(notesKey)
    setNotes(order?.internalNotes || '')
  }

  const customerHistory = useMemo(() => {
    if (!order) return []
    return orders
      .filter((o) => o.id !== order.id && o.customer.phone === order.customer.phone)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [orders, order])

  if (!order && loadStatus.state !== 'ready') {
    return <div className="page"><LoadState status={loadStatus} retry={retry} label="order" /></div>
  }

  if (!order) {
    return <div className="page"><p>Order not found.</p><button className="btn secondary" onClick={() => navigate('/orders')}>Back to orders</button></div>
  }

  // Dispatch needs courier details; cancel/return need an explicit confirmation (and an optional reason).
  const needsDialog = (to) => to === 'dispatched' || to === 'cancelled' || to === 'returned'
  function startTransition(t) {
    if (!needsDialog(t.to)) return runTransition(t.to)
    setCourier(COURIERS[0]); setTracking(''); setReason('')
    setPending(t)
  }
  async function runTransition(to, extra) {
    if (!(await update(order.id, transitionPatch(order, to, extra)))) return
    push(`Order marked ${to}`, to === 'cancelled' || to === 'returned' ? 'danger' : 'success')
    setPending(null)
  }

  async function saveNotes() {
    if (notes === (order.internalNotes || '')) return
    if (!(await update(order.id, { internalNotes: notes }))) return
    push('Notes saved', 'success')
  }

  return (
    <div className="page">
      <button className="btn ghost sm" style={{ marginBottom: 10 }} onClick={() => navigate('/orders')}><ArrowLeft size={14} /> All orders</button>

      <div className="page-head">
        <div>
          <h1 className="mono">{order.orderNo}</h1>
          <p className="desc">Placed {formatDateTime(order.createdAt)}{order.invoiceNo && <> · Invoice <span className="mono">{order.invoiceNo}</span></>}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <StatusPill status={order.status} />
          <button className="btn secondary" onClick={() => printInvoice(order, storeConfig?.brand?.name)}><Printer size={14} /> Print invoice</button>
          {NEXT_STATUS[order.status].map((t) => (
            <button key={t.to} className={`btn ${t.tone === 'danger' ? 'danger' : 'primary'}`} onClick={() => startTransition(t)}>{t.label}</button>
          ))}
        </div>
      </div>

      <OrderStepper status={order.status} />

      {pending && (
        <ConfirmDialog
          title={pending.to === 'dispatched' ? 'Dispatch order' : `${pending.label}?`}
          body={pending.to === 'dispatched'
            ? 'Record who is carrying it so the customer can be given a tracking number.'
            : 'This cannot be undone from the admin. Stock is not restocked automatically.'}
          confirmLabel={pending.label}
          tone={pending.tone === 'danger' ? 'danger' : 'primary'}
          onCancel={() => setPending(null)}
          onConfirm={() => runTransition(pending.to, pending.to === 'dispatched' ? { courier, trackingNo: tracking } : { reason })}
        >
          {pending.to === 'dispatched' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SelectInput label="Courier" value={courier} onChange={(e) => setCourier(e.target.value)} options={COURIERS.map((c) => ({ value: c, label: c }))} />
              <TextInput label="Tracking number (optional)" value={tracking} onChange={(e) => setTracking(e.target.value)} />
            </div>
          ) : (
            <TextInput label="Reason (optional, kept in history)" value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
        </ConfirmDialog>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
        <div className="card">
          <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}><h3 style={{ fontSize: 14 }}>Items</h3></div>
          <div className="table-wrap">
            <table className="grid">
              <thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Price</th><th>Line total</th></tr></thead>
              <tbody>
                {order.lines.map((l, i) => (
                  <tr key={i}>
                    <td>
                      {l.title}<div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{l.variantLabel}</div>
                      {l.customization && (
                        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                          {Object.entries(l.customization).map(([k, v]) => `${k}: ${v}"`).join('  ·  ')}
                        </div>
                      )}
                    </td>
                    <td className="mono">{l.sku}</td>
                    <td>{l.qty}</td>
                    <td className="mono">{formatMoney(l.price)}</td>
                    <td className="mono">{formatMoney({ amount: l.price.amount * l.qty, currency: l.price.currency })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-pad" style={{ borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <Row label="Subtotal" value={formatMoney(order.subtotal)} />
            {order.discount && <Row label={`Discount${order.promoCode ? ` (${order.promoCode})` : ''}`} value={`− ${formatMoney(order.discount)}`} tone="success" />}
            <Row label="Shipping" value={order.shippingFee.amount === 0 ? 'Free' : formatMoney(order.shippingFee)} />
            <Row label="Total" value={formatMoney(order.total)} strong />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-pad">
            <div className="section-title">Customer</div>
            <p style={{ fontWeight: 500 }}>{order.customer.name}</p>
            <p className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{order.customer.phone}</p>
            {order.customer.email && <p style={{ fontSize: 13, color: 'var(--muted)' }}>{order.customer.email}</p>}
          </div>
          <div className="card card-pad">
            <div className="section-title">Shipping address</div>
            <p>{order.shippingAddress.address}</p>
            <p>{order.shippingAddress.city}</p>
            {order.shippingAddress.landmark && <p style={{ color: 'var(--muted)', fontSize: 13 }}>{order.shippingAddress.landmark}</p>}
          </div>
          {order.dispatch && (
            <div className="card card-pad">
              <div className="section-title">Dispatch</div>
              <p>{order.dispatch.courier}</p>
              <p className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{order.dispatch.trackingNo || 'No tracking number'}</p>
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sent {formatDateTime(order.dispatch.dispatchedAt)}</p>
            </div>
          )}
          <div className="card card-pad">
            <div className="section-title">Payment</div>
            <p style={{ textTransform: 'capitalize' }}>{order.paymentMethod.replace('_', ' ')}</p>
          </div>
          {customerHistory.length > 0 && (
            <div className="card card-pad">
              <div className="section-title">Also ordered by this customer</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {customerHistory.map((o) => (
                  <Link key={o.id} to={`/orders/${o.id}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, textDecoration: 'none', color: 'inherit' }}>
                    <span className="mono">{o.orderNo}</span>
                    <span style={{ color: 'var(--muted)' }}>{formatDate(o.createdAt)}</span>
                    <StatusPill status={o.status} />
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="card card-pad">
            <div className="section-title">Status history</div>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...historyOf(order)].reverse().map((h, i) => (
                <li key={i} style={{ fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{h.status}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>{formatDateTime(h.at)}</span>
                  </div>
                  {h.note && <div style={{ color: 'var(--muted)', fontSize: 12 }}>{h.note}</div>}
                </li>
              ))}
            </ol>
          </div>
          <div className="card card-pad">
            <div className="section-title">Internal notes (admin only)</div>
            <TextArea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} placeholder="Never shown to the customer or the storefront…" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, strong, tone }) {
  return (
    <div style={{ display: 'flex', gap: 24, fontSize: strong ? 15 : 13, fontWeight: strong ? 600 : 400, color: tone === 'success' ? 'var(--success)' : undefined }}>
      <span style={{ color: strong ? 'var(--ink)' : 'var(--muted)', minWidth: 90, textAlign: 'right' }}>{label}</span>
      <span className="mono" style={{ minWidth: 90, textAlign: 'right' }}>{value}</span>
    </div>
  )
}