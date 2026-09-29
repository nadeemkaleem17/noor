import { useMemo, useState } from 'react'
import { Star, Check, X } from 'lucide-react'
import { useCollection } from '../hooks/useCollection.js'
import { formatDate } from '../lib/format.js'
import { StatusPill, EmptyState, Drawer, Pill } from '../components/ui.jsx'
import { TextArea } from '../components/Field.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useToast } from '../context/toastContext.js'

const STATUSES = ['all', 'pending', 'approved', 'rejected']
const FIT_LABEL = { runs_small: 'Runs small', true_to_size: 'True to size', runs_large: 'Runs large' }

function Stars({ rating }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1, color: 'var(--warning)' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={13} fill={i < rating ? 'currentColor' : 'none'} strokeWidth={1.5} />
      ))}
    </span>
  )
}

export default function Reviews() {
  const { items: reviews, update } = useCollection('reviews')
  const { items: products } = useCollection('products')
  const push = useToast()
  const [status, setStatus] = useState('all')
  const [productId, setProductId] = useState('all')
  const [open, setOpen] = useState(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [selected, setSelected] = useState(() => new Set())

  const productTitle = (id) => products.find((p) => p.id === id)?.title || id

  const filtered = useMemo(
    () => [...reviews]
      .filter((r) => (status === 'all' ? true : r.status === status))
      .filter((r) => (productId === 'all' ? true : r.productId === productId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [reviews, status, productId],
  )

  const reviewedProducts = useMemo(
    () => [...new Map(reviews.map((r) => [r.productId, productTitle(r.productId)])).entries()],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reviews, products],
  )

  function setDecision(id, next) {
    if (!update(id, { status: next })) return
    push(next === 'approved' ? 'Review approved' : 'Review rejected', next === 'approved' ? 'success' : 'danger')
    setOpen(null)
  }
  function openReview(r) {
    setOpen(r)
    setReplyDraft(r.reply?.body || '')
  }
  function saveReply() {
    if (!update(open.id, { reply: replyDraft.trim() ? { body: replyDraft.trim(), createdAt: new Date().toISOString() } : undefined })) return
    push('Reply saved', 'success')
    setOpen(null)
  }

  function toggleSelected(id) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }
  function toggleSelectAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((r) => r.id)))
  }
  function bulkDecide(next) {
    selected.forEach((id) => update(id, { status: next }))
    push(`${selected.size} review${selected.size === 1 ? '' : 's'} ${next}`, next === 'approved' ? 'success' : 'danger')
    setSelected(new Set())
  }

  return (
    <div className="page">
      <PageHeader
        title="Reviews"
        description="Moderate customer reviews before they appear on a product page. Pending reviews are never shown on the storefront."
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {STATUSES.map((s) => (
            <button key={s} className={`tab ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
              {s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}
              {s === 'pending' && reviews.filter((r) => r.status === 'pending').length > 0
                ? ` (${reviews.filter((r) => r.status === 'pending').length})` : ''}
            </button>
          ))}
        </div>
        <select className="input" style={{ width: 220 }} value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="all">All products</option>
          {reviewedProducts.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 13 }}>{selected.size} selected</span>
          <button className="btn secondary sm" onClick={() => bulkDecide('approved')}><Check size={13} /> Approve</button>
          <button className="btn secondary sm" onClick={() => bulkDecide('rejected')}><X size={13} /> Reject</button>
          <button className="btn ghost sm" onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto' }}>Clear</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card card-pad">
          <EmptyState title="No reviews here" body="Nothing matches this filter yet." />
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: 30 }}><input type="checkbox" checked={selected.size === filtered.length} onChange={toggleSelectAll} /></th>
                <th>Product</th><th>Rating</th><th>Author</th><th>Review</th><th>Fit</th><th>Reply</th><th>Date</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => openReview(r)}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelected(r.id)} /></td>
                  <td>{productTitle(r.productId)}</td>
                  <td><Stars rating={r.rating} /></td>
                  <td>{r.author}</td>
                  <td style={{ maxWidth: 280 }}>
                    {r.title && <div style={{ fontWeight: 500 }}>{r.title}</div>}
                    <div style={{ color: 'var(--muted)', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.body}</div>
                  </td>
                  <td>{r.fit ? FIT_LABEL[r.fit] : '—'}</td>
                  <td>{r.reply ? <Pill tone="info">Replied</Pill> : '—'}</td>
                  <td className="mono">{formatDate(r.createdAt)}</td>
                  <td><StatusPill status={r.status} /></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {r.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn ghost icon sm" title="Approve" onClick={() => setDecision(r.id, 'approved')}><Check size={13} /></button>
                        <button className="btn ghost icon sm" title="Reject" onClick={() => setDecision(r.id, 'rejected')}><X size={13} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Drawer
          title={open.title || `Review by ${open.author}`}
          subtitle={productTitle(open.productId)}
          onClose={() => setOpen(null)}
          footer={(
            <>
              {open.status === 'pending' && <button className="btn danger" onClick={() => setDecision(open.id, 'rejected')}>Reject</button>}
              {open.status === 'pending' && <button className="btn secondary" onClick={() => setDecision(open.id, 'approved')}>Approve</button>}
              <button className="btn primary" onClick={saveReply}>Save reply</button>
            </>
          )}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Stars rating={open.rating} />
            <StatusPill status={open.status} />
          </div>
          <div className="field">
            <label>{open.author} · {formatDate(open.createdAt)}</label>
            <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>{open.body}</p>
          </div>
          {open.fit && (
            <div className="field">
              <label>Fit feedback</label>
              <p style={{ fontSize: 13.5 }}>{FIT_LABEL[open.fit]}</p>
            </div>
          )}
          <TextArea label="Store reply (public, shown under the review)" rows={3} value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} placeholder="Thanks for the feedback…" />
        </Drawer>
      )}
    </div>
  )
}