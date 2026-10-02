import { Link, useNavigate } from 'react-router-dom'
import { Plus, ShoppingBag, MessageSquareText, AlertTriangle } from 'lucide-react'
import { useCollection } from '../hooks/useCollection.js'
import { formatMoney, timeAgo } from '../lib/format.js'
import { StatusPill } from '../components/ui.jsx'
import PageHeader from '../components/PageHeader.jsx'

const DAYS = 14

function RevenueTrend({ orders }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const buckets = Array.from({ length: DAYS }).map((_, i) => {
    const day = new Date(today)
    day.setDate(day.getDate() - (DAYS - 1 - i))
    return { day, amount: 0 }
  })
  orders
    .filter((o) => !['cancelled', 'returned'].includes(o.status))
    .forEach((o) => {
      const d = new Date(o.createdAt)
      d.setHours(0, 0, 0, 0)
      const bucket = buckets.find((b) => b.day.getTime() === d.getTime())
      if (bucket) bucket.amount += o.total.amount
    })
  const max = Math.max(...buckets.map((b) => b.amount), 1)
  const w = 640, h = 120, barW = w / DAYS - 6

  return (
    <svg viewBox={`0 0 ${w} ${h + 20}`} width="100%" style={{ maxWidth: 640 }}>
      {buckets.map((b, i) => {
        const barH = Math.max((b.amount / max) * h, b.amount > 0 ? 3 : 0)
        const x = i * (w / DAYS) + 3
        return (
          <g key={i}>
            <rect x={x} y={h - barH} width={barW} height={barH} rx={2} fill={b.amount > 0 ? 'var(--accent)' : 'var(--line)'} opacity={b.amount > 0 ? 1 : 0.5}>
              <title>{b.day.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}: {formatMoney({ amount: b.amount, currency: 'PKR' })}</title>
            </rect>
            {(i === 0 || i === DAYS - 1 || i === Math.floor(DAYS / 2)) && (
              <text x={x + barW / 2} y={h + 16} fontSize="9" textAnchor="middle" fill="var(--muted)">
                {b.day.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { items: orders } = useCollection('orders')
  const { items: products } = useCollection('products')
  const { items: reviews } = useCollection('reviews')

  const revenue = orders
    .filter((o) => !['cancelled', 'returned'].includes(o.status))
    .reduce((sum, o) => sum + o.total.amount, 0)
  const pending = orders.filter((o) => o.status === 'pending').length
  const lowStockProducts = products.filter((p) => p.variants.some((v) => v.stock.status === 'low_stock'))
  const soldOutProducts = products.filter((p) => p.variants.every((v) => v.stock.status === 'sold_out'))
  const pendingReviews = reviews.filter((r) => r.status === 'pending').length

  const recentOrders = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6)

  const revenueByProduct = new Map()
  orders.filter((o) => !['cancelled', 'returned'].includes(o.status)).forEach((o) => {
    o.lines.forEach((l) => {
      revenueByProduct.set(l.productId, (revenueByProduct.get(l.productId) || 0) + l.price.amount * l.qty)
    })
  })
  const topProducts = [...revenueByProduct.entries()]
    .map(([productId, amount]) => ({ product: products.find((p) => p.id === productId), amount }))
    .filter((x) => x.product)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  const lowStockList = [...lowStockProducts, ...soldOutProducts].slice(0, 6)

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        description="Today's snapshot across catalog and sales."
        actions={(
          <>
            <button className="btn secondary" onClick={() => navigate('/orders')}><ShoppingBag size={15} /> Pending orders</button>
            <button className="btn secondary" onClick={() => navigate('/reviews')}><MessageSquareText size={15} /> Moderate reviews</button>
            <button className="btn primary" onClick={() => navigate('/products')}><Plus size={15} /> New product</button>
          </>
        )}
      />

      <div className="stat-grid">
        <div className="stat-tile">
          <div className="label">Revenue (all orders)</div>
          <div className="value mono">{formatMoney({ amount: revenue, currency: 'PKR' })}</div>
        </div>
        <div className="stat-tile clickable" onClick={() => navigate('/orders')}>
          <div className="label">Pending orders</div>
          <div className="value mono">{pending}</div>
        </div>
        <div className="stat-tile clickable" onClick={() => navigate('/products')}>
          <div className="label">Live products</div>
          <div className="value mono">{products.filter((p) => p.status === 'active').length}</div>
        </div>
        <div className="stat-tile clickable" onClick={() => navigate('/products')}>
          <div className="label">Low / sold out</div>
          <div className="value mono">{lowStockProducts.length + soldOutProducts.length}</div>
          {soldOutProducts.length > 0 && <div className="delta down">▼ {soldOutProducts.length} fully sold out</div>}
        </div>
        <div className="stat-tile clickable" onClick={() => navigate('/reviews')}>
          <div className="label">Reviews to moderate</div>
          <div className="value mono">{pendingReviews}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start', marginBottom: 20 }}>
        <div className="card card-pad">
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Revenue, last {DAYS} days</h3>
          <RevenueTrend orders={orders} />
        </div>
        <div className="card card-pad">
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Top products by revenue</h3>
          {topProducts.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>No sales yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topProducts.map(({ product, amount }) => (
                <div key={product.id} className="clickable" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate(`/products/${product.id}`)}>
                  <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{product.title}</span>
                  <span className="mono" style={{ fontSize: 12.5 }}>{formatMoney({ amount, currency: 'PKR' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
        <div className="card">
          <div className="card-pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 14 }}>Recent orders</h3>
            <Link to="/orders" className="btn ghost sm">View all</Link>
          </div>
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>Order</th><th>Customer</th><th>City</th><th>Status</th><th>Total</th><th>Placed</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="clickable" onClick={() => navigate(`/orders/${o.id}`)}>
                    <td className="mono">{o.orderNo}</td>
                    <td>{o.customer.name}</td>
                    <td>{o.shippingAddress.city}</td>
                    <td><StatusPill status={o.status} /></td>
                    <td className="mono">{formatMoney(o.total)}</td>
                    <td>{timeAgo(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card card-pad">
          <h3 style={{ fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} style={{ color: 'var(--warning)' }} /> Needs attention
          </h3>
          {lowStockList.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Stock levels look healthy.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lowStockList.map((p) => (
                <div key={p.id} className="clickable" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate(`/products/${p.id}`)}>
                  <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{p.title}</span>
                  <StatusPill status={p.variants.every((v) => v.stock.status === 'sold_out') ? 'sold_out' : 'low_stock'} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}