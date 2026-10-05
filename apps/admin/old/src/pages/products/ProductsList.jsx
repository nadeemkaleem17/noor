import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Copy, Trash2, Download, X } from 'lucide-react'
import { syncCollectionMembership } from '../../lib/collections.js'
import { useCollection } from '../../hooks/useCollection.js'
import { formatMoney } from '../../lib/format.js'
import { priceRange, aggregateStock } from '../../lib/variants.js'
import { StatusPill, EmptyState, ConfirmDialog, LoadState, SyncErrorBanner } from '../../components/ui.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { downloadCsv } from '../../lib/csv.js'
import { primaryImage } from '../../lib/images.js'
import { makeId, slugify, randomSuffix } from '../../lib/id.js'
import { useToast } from '../../context/toastContext.js'

// Main gallery image, falling back to the first media item for products without a gallery.
const thumbOf = (p) => primaryImage(p.images)?.url || p.media?.[0]?.url

export default function ProductsList() {
  const navigate = useNavigate()
  const push = useToast()
  const { items: products, create, update, remove, status: loadStatus, retry } = useCollection('products')
  const { items: categories } = useCollection('categories')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [selected, setSelected] = useState(() => new Set())

  const catName = (id) => categories.find((c) => c.id === id)?.name || '—'

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (status !== 'all' && p.status !== status) return false
      if (categoryId !== 'all' && p.primaryCategoryId !== categoryId && !p.categoryIds?.includes(categoryId)) return false
      if (q && !p.title.toLowerCase().includes(q.toLowerCase()) && !p.handle.includes(q.toLowerCase())) return false
      return true
    })
  }, [products, q, status, categoryId])

  function toggleSelected(id) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }
  function toggleSelectAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id)))
  }
  const plural = (n) => `${n} product${n === 1 ? '' : 's'}`
  // One at a time, so each failure gets its own toast and the count below is honest.
  async function bulkSetStatus(next) {
    let done = 0
    for (const id of selected) if (await update(id, { status: next })) done++
    if (done) push(`${plural(done)} set to ${next}`, 'success')
    setSelected(new Set())
  }
  async function bulkDelete() {
    setBulkDeleteOpen(false)
    let done = 0
    for (const id of selected) if (await remove(id)) done++
    syncCollectionMembership()
    if (done) push(`${plural(done)} deleted`, 'danger')
    setSelected(new Set())
  }
  function exportCsv() {
    downloadCsv('products.csv', filtered, [
      { label: 'Title', value: (p) => p.title },
      { label: 'Handle', value: (p) => p.handle },
      { label: 'Category', value: (p) => catName(p.primaryCategoryId) },
      { label: 'Kind', value: (p) => p.kind },
      { label: 'Status', value: (p) => p.status },
      { label: 'Stock', value: (p) => aggregateStock(p) },
      { label: 'Min price', value: (p) => priceRange(p).min / 100 },
      { label: 'Max price', value: (p) => priceRange(p).max / 100 },
      { label: 'Variants', value: (p) => p.variants.length },
    ])
    push(`Exported ${filtered.length} products`, 'success')
  }

  async function handleNew() {
    const title = 'Untitled product'
    const created = await create({
      handle: `${slugify(title)}-${randomSuffix(3)}`,
      status: 'draft',
      kind: 'stitched',
      title,
      primaryCategoryId: categories[0]?.id || '',
      categoryIds: categories[0] ? [categories[0].id] : [],
      collectionIds: [],
      components: [],
      attributes: {},
      options: [],
      variants: [{ id: makeId('v'), sku: 'SKU-NEW', optionValueIds: [], price: { amount: 0, currency: 'PKR' }, stock: { status: 'in_stock', quantity: 0, maxPerOrder: 10 } }],
      media: [],
      images: [],
    }, 'p')
    if (!created) return
    navigate(`/products/${created.id}`)
  }

  async function handleDuplicate(p) {
    const suffix = randomSuffix(3).toUpperCase()
    const copy = await create({
      ...structuredClone(p),
      id: undefined,
      title: `${p.title} (copy)`,
      handle: `${p.handle}-copy-${randomSuffix(2)}`,
      status: 'draft',
      variants: p.variants.map((v) => ({ ...v, sku: `${v.sku}-C${suffix}` })), // SKUs must stay unique
    })
    if (!copy) return
    syncCollectionMembership()
    push('Product duplicated')
    navigate(`/products/${copy.id}`)
  }

  return (
    <div className="page">
      <PageHeader
        title="Products"
        description="Every style, colorway and variant published to the storefront contract."
        actions={(
          <>
            <button className="btn secondary" onClick={exportCsv}><Download size={15} /> Export CSV</button>
            <button className="btn primary" onClick={handleNew}><Plus size={15} /> New product</button>
          </>
        )}
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 320 }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input" style={{ width: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="archived">Archived</option>
        </select>
        <select className="input" style={{ width: 180 }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {(status !== 'all' || categoryId !== 'all' || q) && (
        <div className="filter-bar">
          {q && <span className="filter-chip">"{q}"<button onClick={() => setQ('')} aria-label="Clear search"><X size={11} /></button></span>}
          {status !== 'all' && <span className="filter-chip">{status}<button onClick={() => setStatus('all')} aria-label="Clear status filter"><X size={11} /></button></span>}
          {categoryId !== 'all' && <span className="filter-chip">{catName(categoryId)}<button onClick={() => setCategoryId('all')} aria-label="Clear category filter"><X size={11} /></button></span>}
          <button className="btn ghost sm" onClick={() => { setQ(''); setStatus('all'); setCategoryId('all') }}>Clear all</button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 13 }}>{selected.size} selected</span>
          <button className="btn secondary sm" onClick={() => bulkSetStatus('active')}>Set active</button>
          <button className="btn secondary sm" onClick={() => bulkSetStatus('draft')}>Set draft</button>
          <button className="btn secondary sm" onClick={() => bulkSetStatus('archived')}>Archive</button>
          <button className="btn danger sm" onClick={() => setBulkDeleteOpen(true)}><Trash2 size={13} /> Delete</button>
          <button className="btn ghost sm" onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto' }}>Clear</button>
        </div>
      )}

      <SyncErrorBanner status={products.length ? loadStatus : null} retry={retry} label="products" />
      <div className="card">
        {!products.length && loadStatus.state !== 'ready' ? (
          <div className="card-pad"><LoadState status={loadStatus} retry={retry} label="products" /></div>
        ) : filtered.length === 0 ? (
          <div className="card-pad"><EmptyState title="No products found" body="Try a different search or filter, or create a new product." /></div>
        ) : (
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th style={{ width: 30 }}><input type="checkbox" checked={selected.size === filtered.length} onChange={toggleSelectAll} /></th>
                  <th></th><th>Title</th><th>Category</th><th>Kind</th><th>Price</th><th>Stock</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const range = priceRange(p)
                  return (
                    <tr key={p.id} className="clickable" onClick={() => navigate(`/products/${p.id}`)}>
                      <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelected(p.id)} /></td>
                      <td><img className="thumb" src={thumbOf(p)} alt="" /></td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{p.title}</div>
                        <div className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{p.handle}</div>
                      </td>
                      <td>{catName(p.primaryCategoryId)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{p.kind.replace('-', ' ')}</td>
                      <td className="mono">
                        {range.min === range.max
                          ? formatMoney({ amount: range.min, currency: range.currency })
                          : `${formatMoney({ amount: range.min, currency: range.currency })}+`}
                      </td>
                      <td><StatusPill status={aggregateStock(p)} /></td>
                      <td><StatusPill status={p.status} /></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          <button className="btn ghost icon sm" title="Duplicate" onClick={() => handleDuplicate(p)}><Copy size={14} /></button>
                          <button className="btn ghost icon sm" title="Delete" onClick={() => setDeleteTarget(p)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete "${deleteTarget.title}"?`}
          body="This removes the product and all its variants from the catalog. This can't be undone."
          confirmLabel="Delete product"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            const target = deleteTarget
            setDeleteTarget(null)
            if (!(await remove(target.id))) return
            syncCollectionMembership()
            push('Product deleted', 'danger')
          }}
        />
      )}

      {bulkDeleteOpen && (
        <ConfirmDialog
          title={`Delete ${selected.size} product${selected.size === 1 ? '' : 's'}?`}
          body="This removes the selected products and all their variants from the catalog. This can't be undone."
          confirmLabel="Delete products"
          onCancel={() => setBulkDeleteOpen(false)}
          onConfirm={bulkDelete}
        />
      )}
    </div>
  )
}