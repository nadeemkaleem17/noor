import { Link, useLocation, useParams } from 'react-router-dom'
import { useOrders } from '../../context/OrdersContext'
import { useStoreConfig } from '../../hooks/useStoreConfig'
import { ProductImage } from '../../components/ui'
import { formatPKR, formatDate, toWhatsAppNumber } from '../../utils/format'

function estimatedDelivery(createdAt) {
  const date = new Date(createdAt)
  date.setDate(date.getDate() + 5)
  return date.toISOString()
}

export default function OrderConfirmation() {
  const { id } = useParams()
  const location = useLocation()
  const { orders } = useOrders()
  const store = useStoreConfig()
  const order = location.state?.order || orders.find((o) => o.id === id)

  if (!order) {
    return (
      <div className="confirm-box">
        <h1>We couldn't find that order</h1>
        <p>Use the order number and phone number you checked out with to look it up.</p>
        <Link to="/track-order" className="btn btn-gold">Track your order</Link>
      </div>
    )
  }

  const whatsappText = encodeURIComponent(`Hi! I need help with my order ${order.orderNo}.`)

  return (
    <div className="confirm-box confirm-box-wide">
      <div className="confirm-check">✓</div>
      <h1>Order placed!</h1>
      <p>Thanks {order.customer.name.split(' ')[0]} — we've received your order and will notify you once it's dispatched.</p>
      <div className="confirm-order-no">{order.orderNo} · {formatPKR(order.total)}</div>

      <div className="confirm-lines">
        {order.items.map((item) => (
          <div className="confirm-line" key={item.id + (item.size || '')}>
            <ProductImage seed={`${item.id}-0`} label={item.name} size="sm" />
            <div className="di-info">
              <span className="di-name">{item.name}{item.size ? ` (${item.size})` : ''}</span>
              <span className="di-price">Qty {item.qty} · {formatPKR(item.price * item.qty)}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="confirm-meta">
        Paying by {order.paymentMethod === 'cod' ? 'cash on delivery' : 'card'}, shipping to {order.customer.city}.
        <br />Expected delivery by <strong>{formatDate(estimatedDelivery(order.createdAt))}</strong>.
      </p>

      <div className="confirm-actions">
        <Link to="/shop" className="btn btn-gold">Continue shopping</Link>
        <a
          className="btn btn-outline"
          href={`https://wa.me/${toWhatsAppNumber(store.phone)}?text=${whatsappText}`}
          target="_blank"
          rel="noreferrer"
        >
          Chat with support
        </a>
      </div>
    </div>
  )
}
