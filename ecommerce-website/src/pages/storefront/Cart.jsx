import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { usePromo } from '../../context/PromoContext'
import { ProductImage, EmptyState } from '../../components/ui'
import { formatPKR } from '../../utils/format'

export default function Cart() {
  const { items, updateQty, removeItem, subtotal, discount, shipping, total, appliedPromo, setAppliedPromo } = useCart()
  const { validatePromo } = usePromo()
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState(null)
  const navigate = useNavigate()

  function applyPromo() {
    if (!code.trim()) return
    const result = validatePromo(code, subtotal)
    if (result.ok) {
      setAppliedPromo({ promo: result.promo, discount: result.discount })
      setMsg({ ok: true, text: `${result.promo.code} applied — you saved ${formatPKR(result.discount)}.` })
    } else {
      setMsg({ ok: false, text: result.message })
    }
  }

  function removePromo() {
    setAppliedPromo(null)
    setCode('')
    setMsg(null)
  }

  if (items.length === 0) {
    return (
      <div className="container section">
        <EmptyState
          title="Your bag is empty"
          body="Browse the shop and add something you love."
          action={<Link to="/shop" className="btn btn-gold btn-sm">Start shopping</Link>}
        />
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <h1 className="page-title">Your bag</h1>
      <div className="cart-layout">
        <div className="line-table">
          {items.map((item) => (
            <div className="line-row" key={item.key}>
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
              <span className="line-price-total">{formatPKR(item.price * item.qty)}</span>
            </div>
          ))}
        </div>

        <div className="summary-box">
          <h3>Order summary</h3>

          {appliedPromo ? (
            <div className="applied-promo">
              <span>{appliedPromo.promo.code} applied</span>
              <button onClick={removePromo}>Remove</button>
            </div>
          ) : (
            <>
              <div className="promo-row">
                <input
                  placeholder="Promo code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                />
                <button className="btn btn-outline btn-sm" onClick={applyPromo}>Apply</button>
              </div>
              {msg && <p className={'promo-msg ' + (msg.ok ? 'ok' : 'err')}>{msg.text}</p>}
            </>
          )}

          <div className="summary-row"><span>Subtotal</span><span>{formatPKR(subtotal)}</span></div>
          {discount > 0 && <div className="summary-row"><span>Discount</span><span className="discount-val">−{formatPKR(discount)}</span></div>}
          <div className="summary-row"><span>Shipping</span><span>{shipping === 0 ? 'Free' : formatPKR(shipping)}</span></div>
          <div className="summary-row total"><span>Total</span><span>{formatPKR(total)}</span></div>

          <button className="btn btn-gold btn-block" style={{ marginTop: 8 }} onClick={() => navigate('/checkout')}>
            Proceed to checkout
          </button>
        </div>
      </div>
    </div>
  )
}
