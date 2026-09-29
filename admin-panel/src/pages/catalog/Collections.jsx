import { useState } from 'react'
import { Plus, Trash2, Search } from 'lucide-react'
import { useCollection } from '../../hooks/useCollection.js'
import { Drawer, ConfirmDialog, Pill, EmptyState } from '../../components/ui.jsx'
import { TextInput, TextArea, SelectInput, CheckboxRow } from '../../components/Field.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { slugify, slugifyLoose } from '../../lib/id.js'
import { applyMembership, derivedProductIds } from '../../lib/collections.js'
import { useToast } from '../../context/toastContext.js'

const blank = () => ({ id: null, handle: '', title: '', description: '', status: 'active', memberIds: [] })

export default function Collections() {
  const { items: collections, create, update, remove } = useCollection('collectionsList')
  const { items: products, replaceAll: replaceProducts } = useCollection('products')
  const push = useToast()
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Product.collectionIds is the source of truth, so counts come from the products, not Collection.productIds.
  const count = (id) => derivedProductIds(products, id).length

  function openEdit(c) {
    setEditing({ ...c, description: c.description || '', memberIds: derivedProductIds(products, c.id) })
  }
  async function save(draft) {
    const handle = slugify(draft.handle || draft.title)
    if (!draft.title.trim()) return push('Give the collection a title', 'danger')
    if (!handle) return push('Give the collection a handle', 'danger')
    if (collections.some((c) => c.handle === handle && c.id !== draft.id)) return push(`The handle “${handle}” is already used`, 'danger')

    const base = { handle, title: draft.title.trim(), description: draft.description.trim() || undefined, status: draft.status, productIds: draft.memberIds }
    const saved = draft.id ? update(draft.id, base) : create(base, 'col')
    if (!saved) return // rejected by the contract; keep the editor open
    const id = draft.id || saved.id
    // Products may live on the API: wait for their collectionIds to be written before confirming.
    if (!(await replaceProducts(applyMembership(products, id, draft.memberIds)))) return
    push(draft.id ? 'Collection saved' : 'Collection created', 'success')
    setEditing(null)
  }

  return (
    <div className="page">
      <PageHeader
        title="Collections"
        description="Hand-picked groups of products, like “New In” or “Eid Edit”. A product can sit in any number of collections."
        actions={<button className="btn primary" onClick={() => setEditing(blank())}><Plus size={15} /> New collection</button>}
      />

      {collections.length === 0 ? (
        <EmptyState title="No collections yet" body="Create one to group products for the storefront." />
      ) : (
        <div className="card table-wrap">
          <table className="grid">
            <thead><tr><th>Title</th><th>Handle</th><th>Products</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {collections.map((c) => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(c)}>
                  <td style={{ fontWeight: 500 }}>{c.title}</td>
                  <td className="mono" style={{ color: 'var(--muted)' }}>/{c.handle}</td>
                  <td>{count(c.id)}</td>
                  <td><Pill tone={c.status === 'active' ? 'success' : 'neutral'}>{c.status}</Pill></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row-actions">
                      <button className="btn ghost icon sm" aria-label={`Delete ${c.title}`} onClick={() => setDeleteTarget(c)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <CollectionDrawer
          initial={editing} products={products}
          onCancel={() => setEditing(null)} onSave={save}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete “${deleteTarget.title}”?`}
          body={`${count(deleteTarget.id)} product(s) will be removed from it. The products themselves are not deleted.`}
          confirmLabel="Delete collection"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            const target = deleteTarget
            setDeleteTarget(null)
            if (!(await replaceProducts(applyMembership(products, target.id, [])))) return
            remove(target.id)
            push('Collection deleted', 'danger')
          }}
        />
      )}
    </div>
  )
}

// Mounted only while editing, so its draft state starts fresh each time and never sees a null record.
function CollectionDrawer({ initial, products, onCancel, onSave }) {
  const [draft, setDraft] = useState(initial)
  const [query, setQuery] = useState('')
  const shown = products.filter((p) => p.title.toLowerCase().includes(query.trim().toLowerCase()))
  const toggle = (pid) => setDraft((d) => ({
    ...d, memberIds: d.memberIds.includes(pid) ? d.memberIds.filter((x) => x !== pid) : [...d.memberIds, pid],
  }))
  return (
    <Drawer
      title={draft.id ? 'Edit collection' : 'New collection'}
      onClose={onCancel}
      footer={<><button className="btn secondary" onClick={onCancel}>Cancel</button><button className="btn primary" onClick={() => onSave(draft)}>Save</button></>}
    >
      <TextInput label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      <TextInput
        label="Handle" value={draft.handle} hint="Used in the storefront URL: /collections/handle"
        onChange={(e) => setDraft({ ...draft, handle: slugifyLoose(e.target.value) })}
        onBlur={(e) => setDraft({ ...draft, handle: slugify(e.target.value) })}
      />
      <TextArea label="Description" rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      <SelectInput label="Status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} options={[{ value: 'active', label: 'active' }, { value: 'draft', label: 'draft' }]} />

      <div className="field">
        <label htmlFor="col-product-search">Products in this collection ({draft.memberIds.length})</label>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--muted)' }} />
          <input id="col-product-search" className="input" style={{ paddingLeft: 30 }} placeholder="Search products…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflow: 'auto', marginTop: 8 }}>
          {shown.length === 0 && <span className="hint">No products match.</span>}
          {shown.map((p) => (
            <CheckboxRow key={p.id} label={`${p.title}${p.status !== 'active' ? ` (${p.status})` : ''}`} checked={draft.memberIds.includes(p.id)} onChange={() => toggle(p.id)} />
          ))}
        </div>
      </div>
    </Drawer>
  )
}
