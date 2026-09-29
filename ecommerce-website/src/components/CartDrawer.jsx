import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { ProductImage, EmptyState } from '../components/ui'
import { formatPKR } from '../utils/format'

export default function CartDrawer() {
  const { items, updateQty, removeItem, subtotal, isDrawerOpen, setDrawerOpen } = useCart()

  if (!isDrawerOpen) return null

  return (
    <>
      <div className="overlay" onClick={() => setDrawerOpen(false)} />
      <aside className="drawer" role="dialog" aria-label="Shopping bag">
        <div className="drawer-head">
          <h3>Your bag {items.length > 0 && `(${items.length})`}</h3>
          <button className="modal-close" onClick={() => setDrawerOpen(false)} aria-label="Close bag">×</button>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="Your bag is empty"
            body="Browse the shop and add something you love."
            action={<Link to="/shop" onClick={() => setDrawerOpen(false)} className="btn btn-gold btn-sm">Start shopping</Link>}
          />
        ) : (
          <>
            <div className="drawer-items">
              {items.map((item) => (
                <div className="drawer-item" key={item.key}>
                  <ProductImage src={item.image} seed={`${item.id}-0`} index={item.swatch} label={item.name} size="sm" />
                  <div className="di-info">
                    <span className="di-name">{item.name}</span>
                    {item.size && <span className="di-size">Size: {item.size}</span>}
                    <span className="di-price">{formatPKR(item.price)}</span>
                    <div className="di-meta">
                      <div className="qty-row">
                        <button className="qty-btn" onClick={() => updateQty(item.key, item.qty - 1)}>−</button>
                        <span className="qty-val">{item.qty}</span>
                        <button className="qty-btn" onClick={() => updateQty(item.key, item.qty + 1)} disabled={item.qty >= item.stock}>+</button>
                      </div>
                      <button className="remove-link" onClick={() => removeItem(item.key)}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="drawer-foot">
              <div className="subtotal-row">
                <span>Subtotal</span>
                <strong>{formatPKR(subtotal)}</strong>
              </div>
              <p className="foot-note">Shipping and promo codes calculated at checkout.</p>
              <Link to="/cart" className="btn btn-outline btn-block" onClick={() => setDrawerOpen(false)}>View bag</Link>
              <Link to="/checkout" className="btn btn-gold btn-block checkout-btn" onClick={() => setDrawerOpen(false)}>Checkout</Link>
            </div>
          </>
        )}
      </aside>
    </>
  )
}