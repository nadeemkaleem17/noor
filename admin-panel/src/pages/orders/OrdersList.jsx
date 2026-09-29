import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Download } from 'lucide-react'
import { useCollection } from '../../hooks/useCollection.js'
import { formatMoney, formatDateTime } from '../../lib/format.js'
import { StatusPill, EmptyState } from '../../components/ui.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { downloadCsv } from '../../lib/csv.js'
import { useToast } from '../../context/toastContext.js'

const STATUSES = ['all', 'pending', 'confirmed', 'dispatched', 'delivered', 'cancelled', 'returned']

export default function OrdersList() {
  const navigate = useNavigate()
  const push = useToast()
  const { items: orders } = useCollection('orders')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const filtered = useMemo(() => {
    return [...orders]
      .filter((o) => (status === 'all' ? true : o.status === status))
      .filter((o) => !q || o.orderNo.toLowerCase().includes(q.toLowerCase()) || o.customer.name.toLowerCase().includes(q.toLowerCase()) || o.customer.phone.includes(q))
      .filter((o) => !from || new Date(o.createdAt) >= new Date(from))
      .filter((o) => !to || new Date(o.createdAt) <= new Date(`${to}T23:59:59`))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [orders, q, status, from, to])

  function exportCsv() {
    downloadCsv('orders.csv', filtered, [
      { label: 'Order #', value: (o) => o.orderNo },
      { label: 'Customer', value: (o) => o.customer.name },
      { label: 'Phone', value: (o) => o.customer.phone },
      { label: 'City', value: (o) => o.shippingAddress.city },
      { label: 'Items', value: (o) => o.lines.reduce((n, l) => n + l.qty, 0) },
      { label: 'Total', value: (o) => o.total.amount / 100 },
      { label: 'Payment', value: (o) => o.paymentMethod },
      { label: 'Status', value: (o) => o.status },
      { label: 'Placed', value: (o) => o.createdAt },
    ])
    push(`Exported ${filtered.length} orders`, 'success')
  }

  return (
    <div className="page">
      <PageHeader
        title="Orders"
        description="Every order placed on the storefront, server-authoritative totals (doc 03 §1)."
        actions={<button className="btn secondary" onClick={exportCsv}><Download size={15} /> Export CSV</button>}
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 320 }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Search order #, name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <input className="input" style={{ width: 150 }} type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
        <input className="input" style={{ width: 150 }} type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUSES.map((s) => (
            <button key={s} className={`btn sm ${status === s ? 'primary' : 'secondary'}`} onClick={() => setStatus(s)} style={{ textTransform: 'capitalize' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="card-pad"><EmptyState title="No orders match" body="Try clearing the search or status filter." /></div>
        ) : (
          <div className="table-wrap">
            <table className="grid">
              <thead><tr><th>Order</th><th>Customer</th><th>City</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Placed</th></tr></thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="clickable" onClick={() => navigate(`/orders/${o.id}`)}>
                    <td className="mono">{o.orderNo}</td>
                    <td>{o.customer.name}<div style={{ fontSize: 11.5, color: 'var(--muted)' }} className="mono">{o.customer.phone}</div></td>
                    <td>{o.shippingAddress.city}</td>
                    <td>{o.lines.reduce((n, l) => n + l.qty, 0)}</td>
                    <td className="mono">{formatMoney(o.total)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{o.paymentMethod.replace('_', ' ')}</td>
                    <td><StatusPill status={o.status} /></td>
                    <td>{formatDateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}