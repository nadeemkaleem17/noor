import { useState } from 'react'
import { Plus, Trash2, ChevronRight } from 'lucide-react'
import { useCollection } from '../../hooks/useCollection.js'
import { Drawer, ConfirmDialog } from '../../components/ui.jsx'
import { TextInput, SelectInput, CheckboxRow } from '../../components/Field.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { slugify, slugifyLoose } from '../../lib/id.js'
import { useToast } from '../../context/toastContext.js'

export default function Categories() {
  const { items: categories, create, update, remove } = useCollection('categories')
  const { items: attributes } = useCollection('attributes')
  const { items: products } = useCollection('products')
  const push = useToast()
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [collapsedIds, setCollapsedIds] = useState(() => new Set())

  const roots = categories.filter((c) => !c.parentId)
  const childrenOf = (id) => categories.filter((c) => c.parentId === id)
  // Every category below `id`, at any depth: used to stop a category being moved under itself.
  const descendantIds = (id) => childrenOf(id).flatMap((c) => [c.id, ...descendantIds(c.id)])
  const productCount = (id) => products.filter((p) => p.primaryCategoryId === id || p.categoryIds?.includes(id)).length
  const toggleOpen = (id) => setCollapsedIds((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  function openNew() {
    setEditing({ id: null, handle: '', name: '', parentId: null, filterSchema: [] })
  }

  function save() {
    // The contract has parentId as optional (never null), so leave it out for top-level categories.
    const payload = { ...editing, handle: slugify(editing.handle || editing.name), parentId: editing.parentId || undefined }
    const saved = editing.id ? update(editing.id, payload) : create(payload, 'cat')
    if (!saved) return // rejected by the contract; the toast already says why, keep the editor open
    push(editing.id ? 'Category updated' : 'Category created', 'success')
    setEditing(null)
  }

  function Row({ cat, depth }) {
    const children = childrenOf(cat.id)
    const hasChildren = children.length > 0
    const open = !collapsedIds.has(cat.id)
    return (
      <>
        <tr className="clickable" onClick={() => setEditing(cat)}>
          <td style={{ paddingLeft: 16 + depth * 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {hasChildren ? (
                <button
                  type="button"
                  className="tree-toggle"
                  data-state={open ? 'open' : 'closed'}
                  aria-expanded={open}
                  aria-label={open ? `Collapse ${cat.name}` : `Expand ${cat.name}`}
                  onClick={(e) => { e.stopPropagation(); toggleOpen(cat.id) }}
                >
                  <ChevronRight size={14} />
                </button>
              ) : (
                <span className="tree-toggle spacer"><ChevronRight size={14} /></span>
              )}
              {cat.name}
            </div>
          </td>
          <td className="mono" style={{ color: 'var(--muted)' }}>/{cat.handle}</td>
          <td>{cat.filterSchema?.join(', ') || '—'}</td>
          <td onClick={(e) => e.stopPropagation()}>
            <div className="row-actions">
              <button
                className="btn ghost icon sm" aria-label={`Delete ${cat.name}`}
                onClick={() => {
                  const n = productCount(cat.id)
                  if (n > 0) push(`Can't delete "${cat.name}": ${n} product${n === 1 ? '' : 's'} still use it`, 'danger')
                  else setDeleteTarget(cat)
                }}
              ><Trash2 size={13} /></button>
            </div>
          </td>
        </tr>
        {hasChildren && open && children.map((child) => <Row key={child.id} cat={child} depth={depth + 1} />)}
      </>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Categories"
        description="The category tree that drives storefront navigation and filter panels (doc 02 §1)."
        actions={<button className="btn primary" onClick={openNew}><Plus size={15} /> New category</button>}
      />
      <div className="card table-wrap">
        <table className="grid">
          <thead><tr><th>Name</th><th>Handle</th><th>Filters shown</th><th></th></tr></thead>
          <tbody>{roots.map((c) => <Row key={c.id} cat={c} depth={0} />)}</tbody>
        </table>
      </div>

      {editing && (
        <Drawer
          title={editing.id ? 'Edit category' : 'New category'}
          onClose={() => setEditing(null)}
          footer={<><button className="btn secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}
        >
          <TextInput label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          <TextInput label="Handle" value={editing.handle} onChange={(e) => setEditing({ ...editing, handle: slugifyLoose(e.target.value) })} onBlur={(e) => setEditing({ ...editing, handle: slugify(e.target.value) })} hint="Used in the storefront URL: /c/handle" />
          <SelectInput
            label="Parent category" value={editing.parentId || ''}
            onChange={(e) => setEditing({ ...editing, parentId: e.target.value || null })}
            options={[{ value: '', label: 'None (top level)' }, ...categories.filter((c) => c.id !== editing.id && !(editing.id && descendantIds(editing.id).includes(c.id))).map((c) => ({ value: c.id, label: c.name }))]}
          />
          <div className="field">
            <label>Filters shown in this category</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {attributes.map((a) => (
                <CheckboxRow
                  key={a.key} label={a.label}
                  checked={editing.filterSchema?.includes(a.key)}
                  onChange={() => {
                    const has = editing.filterSchema?.includes(a.key)
                    setEditing({ ...editing, filterSchema: has ? editing.filterSchema.filter((k) => k !== a.key) : [...(editing.filterSchema || []), a.key] })
                  }}
                />
              ))}
            </div>
          </div>
        </Drawer>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete "${deleteTarget.name}"?`}
          body="Any sub-categories will move up one level."
          confirmLabel="Delete category"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            categories.filter((c) => c.parentId === deleteTarget.id).forEach((c) => update(c.id, { parentId: deleteTarget.parentId || undefined }))
            remove(deleteTarget.id)
            push('Category deleted', 'danger')
            setDeleteTarget(null)
          }}
        />
      )}
    </div>
  )
}