import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, CornerDownRight } from 'lucide-react'
import { useCollection } from '../../hooks/useCollection.js'
import { TextInput } from '../../components/Field.jsx'
import { EmptyState } from '../../components/ui.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { makeId } from '../../lib/id.js'
import { useToast } from '../../context/toastContext.js'

// Patch one node (by id) anywhere in a menu tree, immutably.
function patchNode(items, id, patch) {
  return items.map((it) => {
    if (it.id === id) return { ...it, ...patch }
    if (it.children?.length) return { ...it, children: patchNode(it.children, id, patch) }
    return it
  })
}
function removeNode(items, id) {
  return items
    .filter((it) => it.id !== id)
    .map((it) => (it.children?.length ? { ...it, children: removeNode(it.children, id) } : it))
}
// Move an item up/down among its siblings, wherever in the tree it lives.
function moveNode(items, id, dir) {
  const idx = items.findIndex((it) => it.id === id)
  if (idx !== -1) {
    const swap = idx + dir
    if (swap < 0 || swap >= items.length) return items
    const next = [...items]
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    return next
  }
  return items.map((it) => (it.children?.length ? { ...it, children: moveNode(it.children, id, dir) } : it))
}
function addChild(items, parentId) {
  return items.map((it) => {
    if (it.id === parentId) {
      return { ...it, children: [...(it.children || []), { id: makeId('m'), label: 'New link', href: '/', children: [] }] }
    }
    if (it.children?.length) return { ...it, children: addChild(it.children, parentId) }
    return it
  })
}

function ItemRow({ item, onPatch, onRemove, onAddChild, onMove, index, siblingCount, depth, onSaved }) {
  function trackedBlur(e) {
    if (e.target.dataset.initial !== e.target.value) onSaved()
  }
  function trackedFocus(e) {
    e.target.dataset.initial = e.target.value
  }
  return (
    <div style={{ marginLeft: depth * 28 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 8 }}>
        {depth > 0 && <CornerDownRight size={14} style={{ color: 'var(--muted)', marginBottom: 10 }} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button className="btn ghost icon sm" aria-label="Move up" disabled={index === 0} onClick={() => onMove(item.id, -1)}><ChevronUp size={13} /></button>
          <button className="btn ghost icon sm" aria-label="Move down" disabled={index === siblingCount - 1} onClick={() => onMove(item.id, 1)}><ChevronDown size={13} /></button>
        </div>
        <div style={{ flex: 1 }}>
          <TextInput label="Label" value={item.label} onChange={(e) => onPatch(item.id, { label: e.target.value })} onFocus={trackedFocus} onBlur={trackedBlur} />
        </div>
        <div style={{ flex: 1 }}>
          <TextInput label="Link (href)" value={item.href} onChange={(e) => onPatch(item.id, { href: e.target.value })} onFocus={trackedFocus} onBlur={trackedBlur} />
        </div>
        {depth === 0 && (
          <button className="btn ghost icon sm" aria-label="Add sub-link" onClick={() => onAddChild(item.id)}><Plus size={13} /></button>
        )}
        <button className="btn ghost icon sm" aria-label="Remove link" onClick={() => onRemove(item.id)}><Trash2 size={13} /></button>
      </div>
      {item.children?.map((child, i) => (
        <ItemRow
          key={child.id} item={child} onPatch={onPatch} onRemove={onRemove}
          onAddChild={onAddChild} onMove={onMove} index={i} siblingCount={item.children.length}
          depth={depth + 1} onSaved={onSaved}
        />
      ))}
    </div>
  )
}

export default function Menus() {
  const { items: menus, update } = useCollection('menus')
  const push = useToast()
  const [activeId, setActiveId] = useState(menus[0]?.id)

  const menu = menus.find((m) => m.id === activeId) || menus[0]

  if (!menu) {
    return (
      <div className="page">
        <PageHeader title="Menus" description="Navigation menus rendered by the storefront (header, footer)." />
        <div className="card card-pad"><EmptyState title="No menus yet" body="Menus are seeded from the data contract; none were found." /></div>
      </div>
    )
  }

  function patchItems(next) {
    update(menu.id, { items: next })
  }
  function addItem() {
    patchItems([...menu.items, { id: makeId('m'), label: 'New link', href: '/', children: [] }])
  }
  function patchItem(id, p) {
    patchItems(patchNode(menu.items, id, p))
  }
  function removeItem(id) {
    patchItems(removeNode(menu.items, id))
  }
  function addChildTo(parentId) {
    patchItems(addChild(menu.items, parentId))
  }
  function move(id, dir) {
    patchItems(moveNode(menu.items, id, dir))
  }
  function saveToast() {
    push('Menu saved', 'success')
  }

  return (
    <div className="page">
      <PageHeader
        title="Menus"
        description="Navigation menus rendered by the storefront — header nav and footer links, with one level of sub-links. Changes save as you type."
      />

      <div className="tabs">
        {menus.map((m) => (
          <button key={m.id} className={`tab ${menu.id === m.id ? 'active' : ''}`} onClick={() => setActiveId(m.id)}>
            {m.handle}
          </button>
        ))}
      </div>

      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 820 }}>
        {menu.items.length === 0 && <EmptyState title="No links yet" body="Add the first link in this menu." />}
        {menu.items.map((item, i) => (
          <ItemRow
            key={item.id} item={item} onPatch={patchItem} onRemove={(id) => { removeItem(id); push('Link removed', 'danger') }}
            onAddChild={addChildTo} onMove={move} index={i} siblingCount={menu.items.length} depth={0} onSaved={saveToast}
          />
        ))}
        <button className="btn secondary" style={{ alignSelf: 'flex-start', marginTop: 8 }} onClick={addItem}><Plus size={15} /> Add link</button>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>Sub-links appear under a top-level item (one level deep, matching the storefront's mega-menu). Use the + on a row to add one.</p>
    </div>
  )
}