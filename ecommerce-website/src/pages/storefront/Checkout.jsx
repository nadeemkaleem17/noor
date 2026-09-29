import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { useOrders } from '../../context/OrdersContext'
import { useCatalog } from '../../context/CatalogContext'
import { usePromo } from '../../context/PromoContext'
import { EmptyState } from '../../components/ui'
import { formatPKR } from '../../utils/format'

const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta']

export default function Checkout() {
  const { items, subtotal, discount, shipping, total, appliedPromo, clearCart } = useCart()
  const { placeOrder } = useOrders()
  const { decrementStock } = useCatalog()
  const { recordUsage } = usePromo()
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', phone: '', address: '', city: 'Lahore' })
  const [payment, setPayment] = useState('cod')
  const [errors, setErrors] = useState({})
  const [placing, setPlacing] = useState(false)
  const nameRef = useRef(null)
  const phoneRef = useRef(null)
  const addressRef = useRef(null)
  const fieldRefs = { name: nameRef, phone: phoneRef, address: addressRef }

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function validate() {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Please enter your full name.'
    if (!/^0\d{3,4}-?\d{6,7}$/.test(form.phone.trim())) errs.phone = 'Enter a valid Pakistani phone number, e.g. 0300-1234567.'
    if (!form.address.trim()) errs.address = 'Please enter a delivery address.'
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const firstField = ['name', 'phone', 'address'].find((f) => errs[f])
      fieldRefs[firstField]?.current?.focus()
    }
    return Object.keys(errs).length === 0
  }

  function handlePlaceOrder() {
    if (placing) return // idempotent guard — no double submit
    if (!validate()) return
    setPlacing(true)
    const order = placeOrder({
      customer: { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), city: form.city },
      items: items.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, size: i.size || null })),
      subtotal, discount, shipping, total,
      promoCode: appliedPromo ? appliedPromo.promo.code : null,
      paymentMethod: payment,
    })
    decrementStock(items)
    if (appliedPromo) recordUsage(appliedPromo.promo.id)
    clearCart()
    navigate('/order-confirmation/' + order.id, { state: { order } })
  }

  if (items.length === 0) {
    return (
      <div className="container section">
        <EmptyState
          title="Your bag is empty"
          body="Add something to your bag before checking out."
          action={<Link to="/shop" className="btn btn-gold btn-sm">Start shopping</Link>}
        />
      </div>
    )
  }

  const errorCount = Object.keys(errors).length

  return (
    <div className="page-wrap">
      <h1 className="page-title">Checkout</h1>

      {errorCount > 0 && (
        <div className="error-summary" role="alert">
          <strong>Please fix {errorCount} field{errorCount > 1 ? 's' : ''} before continuing:</strong>
          <ul>
            {Object.entries(errors).map(([field, msg]) => <li key={field}>{msg}</li>)}
          </ul>
        </div>
      )}

      <div className="checkout-layout">
        <div>
          <div className="field">
            <label htmlFor="ck-name">Full name</label>
            <input id="ck-name" ref={nameRef} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Your name" aria-invalid={!!errors.name} />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>
          <div className="field">
            <label htmlFor="ck-phone">Phone number</label>
            <input id="ck-phone" ref={phoneRef} value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="0300-1234567" inputMode="tel" autoComplete="tel" aria-invalid={!!errors.phone} />
            {errors.phone && <span className="error-text">{errors.phone}</span>}
          </div>
          <div className="field">
            <label htmlFor="ck-address">Delivery address</label>
            <textarea id="ck-address" ref={addressRef} rows={3} value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="House, street, area" aria-invalid={!!errors.address} />
            {errors.address && <span className="error-text">{errors.address}</span>}
          </div>
          <div className="field">
            <label htmlFor="ck-city">City</label>
            <select id="ck-city" value={form.city} onChange={(e) => update('city', e.target.value)}>
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Payment method</label>
            <div className="pay-options">
              <label className={'pay-option' + (payment === 'cod' ? ' selected' : '')}>
                <input type="radio" name="pay" checked={payment === 'cod'} onChange={() => setPayment('cod')} />
                Cash on delivery
              </label>
              <label className={'pay-option' + (payment === 'card' ? ' selected' : '')}>
                <input type="radio" name="pay" checked={payment === 'card'} onChange={() => setPayment('card')} />
                Credit / debit card
              </label>
            </div>
          </div>
        </div>

        <div className="summary-box">
          <h3>Order summary</h3>
          {items.map((item) => (
            <div className="summary-row" key={item.key}>
              <span>{item.name}{item.size ? ` (${item.size})` : ''} × {item.qty}</span>
              <span>{formatPKR(item.price * item.qty)}</span>
            </div>
          ))}
          <div className="summary-row" style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 4 }}>
            <span>Subtotal</span><span>{formatPKR(subtotal)}</span>
          </div>
          {discount > 0 && <div className="summary-row"><span>Discount</span><span className="discount-val">−{formatPKR(discount)}</span></div>}
          <div className="summary-row"><span>Shipping</span><span>{shipping === 0 ? 'Free' : formatPKR(shipping)}</span></div>
          <div className="summary-row total"><span>Total</span><span>{formatPKR(total)}</span></div>

          <button className="btn btn-gold btn-block" style={{ marginTop: 8 }} disabled={placing} onClick={handlePlaceOrder}>
            {placing ? 'Placing order…' : payment === 'cod' ? 'Place order' : 'Pay & place order'}
          </button>
        </div>
      </div>
    </div>
  )
}
