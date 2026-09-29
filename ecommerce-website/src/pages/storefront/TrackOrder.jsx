import { useState } from 'react'
import { useOrders } from '../../context/OrdersContext'
import { formatDate } from '../../utils/format'

const STEPS = ['pending', 'dispatched', 'delivered']
const STEP_LABELS = { pending: 'Confirmed', dispatched: 'Dispatched', delivered: 'Delivered' }

// The admin moves orders through pending → confirmed → dispatched → delivered (or cancelled/returned).
// "confirmed" is shown on the first step, which is already labelled Confirmed.
const stepOf = (status) => (status === 'confirmed' ? 0 : STEPS.indexOf(status))

export default function TrackOrder() {
  const { findOrder } = useOrders()
  const [orderNo, setOrderNo] = useState('')
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState(null) // 'not-found' | order object
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitted(true)
    setLoading(true)
    setError(null)
    try {
      // Never reveal whether the order number exists on its own — only a full match returns a result.
      const match = await findOrder(orderNo, phone)
      setResult(match || 'not-found')
    } catch (err) {
      setResult(null)
      setError(err.message || "We couldn't check your order right now.")
    } finally {
      setLoading(false)
    }
  }

  const ended = result && result !== 'not-found' && (result.status === 'cancelled' || result.status === 'returned')
  const activeStepIndex = result && result !== 'not-found' && !ended ? stepOf(result.status) : -1

  return (
    <div className="page-wrap" style={{ maxWidth: 640 }}>
      <h1 className="page-title">Track your order</h1>

      <form className="track-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="to-orderno">Order number</label>
          <input id="to-orderno" placeholder="#1042" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="to-phone">Phone number</label>
          <input id="to-phone" placeholder="0300-1234567" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required />
        </div>
        <button className="btn btn-gold" type="submit" disabled={loading}>{loading ? 'Checking…' : 'Track order'}</button>
      </form>

      {error && (
        <p className="track-not-found" role="alert">{error} Please try again in a moment.</p>
      )}

      {submitted && !loading && result === 'not-found' && (
        <p className="track-not-found">We couldn't find that order. Please check the order number and phone number and try again.</p>
      )}

      {result && result !== 'not-found' && (
        <div className="track-result">
          <div className="track-timeline">
            {ended ? (
              <div className="track-cancelled">This order was {result.status}.</div>
            ) : (
              STEPS.map((step, i) => (
                <div key={step} className={'track-step' + (i <= activeStepIndex ? ' done' : '')}>
                  <span className="track-dot" />
                  <span className="track-label">{STEP_LABELS[step]}</span>
                  {step === 'dispatched' && result.dispatch && (
                    <span className="track-sub">{[result.dispatch.courier, result.dispatch.trackingNo].filter(Boolean).join(' · ')}</span>
                  )}
                  {step === 'pending' && <span className="track-sub">{formatDate(result.createdAt)}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
