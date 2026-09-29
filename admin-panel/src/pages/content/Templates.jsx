import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, EyeOff, Eye, LayoutTemplate } from 'lucide-react'
import { useCollection } from '../../hooks/useCollection.js'
import { TextInput, TextArea, CheckboxRow } from '../../components/Field.jsx'
import { Drawer, ConfirmDialog, EmptyState, Pill } from '../../components/ui.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { makeId } from '../../lib/id.js'
import { useToast } from '../../context/toastContext.js'

const TYPE_LABELS = {
  home: 'Home', category: 'Category', collection: 'Collection', product: 'Product',
  page: 'CMS page', cart: 'Cart', search: 'Search',
}
const TYPE_ORDER = ['home', 'category', 'collection', 'product', 'page', 'cart', 'search']
const SECTION_TYPE_SUGGESTIONS = [
  'hero', 'announcement_bar', 'banner', 'rich_text', 'rich_text_tabs', 'image_with_text',
  'featured_collection', 'product_grid', 'related_products', 'filter_bar', 'media_gallery',
  'buy_box', 'reviews_list', 'testimonials', 'newsletter', 'faq', 'cart_lines', 'cart_summary',
  'search_bar', 'custom_html',
]
const BLOCK_TYPE_SUGGESTIONS = ['quote', 'tab', 'image', 'text', 'button', 'faq_item']

function tryParseJson(text) {
  try {
    const value = text.trim() === '' ? {} : JSON.parse(text)
    return { ok: true, value }
  } catch {
    return { ok: false }
  }
}
function pretty(obj) {
  return JSON.stringify(obj ?? {}, null, 2)
}

function blankSection() {
  return { id: null, isNew: true, type: 'rich_text', disabled: false, settingsText: '{}', blocks: [] }
}
function sectionToDraft(section) {
  return {
    id: section.id,
    isNew: false,
    type: section.type,
    disabled: !!section.disabled,
    settingsText: pretty(section.settings),
    blocks: (section.blockOrder || [])
      .map((bid) => section.blocks?.[bid])
      .filter(Boolean)
      .map((b) => ({ id: b.id, type: b.type, settingsText: pretty(b.settings) })),
  }
}

export default function Templates() {
  const { items: templates, update } = useCollection('templates')
  const push = useToast()
  const [activeType, setActiveType] = useState('home')
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const template = templates.find((t) => t.type === activeType)

  function moveSection(id, dir) {
    if (!template) return
    const idx = template.order.indexOf(id)
    const swap = idx + dir
    if (swap < 0 || swap >= template.order.length) return
    const next = [...template.order]
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    update(template.id, { order: next })
  }
  function toggleDisabled(section) {
    update(template.id, { sections: { ...template.sections, [section.id]: { ...section, disabled: !section.disabled } } })
  }
  function removeSection(section) {
    const sections = { ...template.sections }
    delete sections[section.id]
    update(template.id, { sections, order: template.order.filter((id) => id !== section.id) })
    push('Section removed', 'danger')
    setDeleteTarget(null)
  }
  function openNewSection() {
    setEditing(blankSection())
  }
  function openEditSection(section) {
    setEditing(sectionToDraft(section))
  }

  function patchBlock(blockId, patch) {
    setEditing((d) => (d ? { ...d, blocks: (d.blocks || []).map((b) => (b.id === blockId ? { ...b, ...patch } : b)) } : d))
  }
  function addBlock() {
    setEditing((d) => (d ? { ...d, blocks: [...(d.blocks || []), { id: makeId('blk'), type: 'text', settingsText: '{}' }] } : d))
  }
  function removeBlock(blockId) {
    setEditing((d) => (d ? { ...d, blocks: (d.blocks || []).filter((b) => b.id !== blockId) } : d))
  }
  function moveBlock(blockId, dir) {
    setEditing((d) => {
      if (!d) return d
      const blocks = d.blocks || []
      const idx = blocks.findIndex((b) => b.id === blockId)
      const swap = idx + dir
      if (swap < 0 || swap >= blocks.length) return d
      const next = [...blocks]
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return { ...d, blocks: next }
    })
  }

  function saveSection() {
    if (!template) return
    const parsedSettings = tryParseJson(editing.settingsText)
    if (!parsedSettings.ok) {
      push('Section settings must be valid JSON', 'danger')
      return
    }
    const editingBlocks = editing.blocks || []
    for (const b of editingBlocks) {
      if (!tryParseJson(b.settingsText).ok) {
        push(`Block "${b.type}" settings must be valid JSON`, 'danger')
        return
      }
    }
    const id = editing.id || makeId('sec')
    const blocks = Object.fromEntries(editingBlocks.map((b) => [b.id, { id: b.id, type: b.type, settings: tryParseJson(b.settingsText).value }]))
    const blockOrder = editingBlocks.map((b) => b.id)
    const section = { id, type: editing.type, settings: parsedSettings.value, blocks, blockOrder, disabled: editing.disabled }

    const sections = { ...template.sections, [id]: section }
    const order = editing.isNew ? [...template.order, id] : template.order
    update(template.id, { sections, order })
    push(editing.isNew ? 'Section added' : 'Section saved', 'success')
    setEditing(null)
  }

  return (
    <div className="page">
      <PageHeader
        title="Page templates"
        description="The section/block layout the storefront's theme renderer reads for each page type — this is the admin side of the theme customizer. Rendering isn't wired to the storefront yet (see doc, Part C)."
        actions={<button className="btn primary" onClick={openNewSection} disabled={!template}><Plus size={15} /> Add section</button>}
      />

      <div className="tabs">
        {TYPE_ORDER.map((t) => (
          <button key={t} className={`tab ${activeType === t ? 'active' : ''}`} onClick={() => setActiveType(t)}>
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {!template ? (
        <div className="card card-pad">
          <EmptyState title="No template yet" body={`No page template exists for "${TYPE_LABELS[activeType]}".`} />
        </div>
      ) : template.order.length === 0 ? (
        <div className="card card-pad">
          <EmptyState title="No sections yet" body="Add the first section to this template." action={<button className="btn primary" onClick={openNewSection}>Add section</button>} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 760 }}>
          {template.order.map((id, i) => {
            const section = template.sections[id]
            if (!section) return null
            const blockCount = (section.blockOrder || []).length
            return (
              <div key={id} className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: section.disabled ? 0.55 : 1 }}>
                <LayoutTemplate size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13.5 }}>{section.type}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {blockCount > 0 ? `${blockCount} block${blockCount === 1 ? '' : 's'}` : 'No blocks'}
                    {section.disabled && ' · Hidden'}
                  </div>
                </div>
                {section.disabled && <Pill tone="neutral">Hidden</Pill>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button className="btn ghost icon sm" aria-label="Move section up" disabled={i === 0} onClick={() => moveSection(id, -1)}><ChevronUp size={13} /></button>
                  <button className="btn ghost icon sm" aria-label="Move section down" disabled={i === template.order.length - 1} onClick={() => moveSection(id, 1)}><ChevronDown size={13} /></button>
                </div>
                <button className="btn ghost icon sm" aria-label={section.disabled ? 'Show on storefront' : 'Hide from storefront'} title={section.disabled ? 'Show on storefront' : 'Hide from storefront'} onClick={() => toggleDisabled(section)}>
                  {section.disabled ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button className="btn secondary sm" onClick={() => openEditSection(section)}>Edit</button>
                <button className="btn ghost icon sm" aria-label="Delete section" onClick={() => setDeleteTarget(section)}><Trash2 size={13} /></button>
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <Drawer
          title={editing.isNew ? 'Add section' : `Edit "${editing.type}"`}
          subtitle={TYPE_LABELS[activeType] + ' template'}
          onClose={() => setEditing(null)}
          width={560}
          footer={<><button className="btn secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" onClick={saveSection}>Save</button></>}
        >
          <div className="form-grid">
            <TextInput
              label="Section type"
              list="section-type-suggestions"
              value={editing.type}
              onChange={(e) => setEditing({ ...editing, type: e.target.value })}
            />
            <datalist id="section-type-suggestions">
              {SECTION_TYPE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <CheckboxRow label="Hidden from storefront" checked={editing.disabled} onChange={(v) => setEditing({ ...editing, disabled: v })} />
          <TextArea
            label="Settings (JSON)"
            hint="Arbitrary key/value settings for this section type — heading, media, links, etc."
            rows={7}
            value={editing.settingsText}
            onChange={(e) => setEditing({ ...editing, settingsText: e.target.value })}
          />

          <div className="divider" />
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Blocks</span>
            <button className="btn ghost sm" onClick={addBlock}><Plus size={13} /> Add block</button>
          </div>
          {(editing.blocks || []).length === 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8 }}>No blocks — used for repeatable items inside a section (quotes, tabs, FAQ items…).</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(editing.blocks || []).map((b, i) => (
              <div key={b.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="input" style={{ flex: 1 }} list="block-type-suggestions" value={b.type} onChange={(e) => patchBlock(b.id, { type: e.target.value })} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button className="btn ghost icon sm" aria-label="Move block up" disabled={i === 0} onClick={() => moveBlock(b.id, -1)}><ChevronUp size={12} /></button>
                    <button className="btn ghost icon sm" aria-label="Move block down" disabled={i === (editing.blocks || []).length - 1} onClick={() => moveBlock(b.id, 1)}><ChevronDown size={12} /></button>
                  </div>
                  <button className="btn ghost icon sm" aria-label="Delete block" onClick={() => removeBlock(b.id)}><Trash2 size={13} /></button>
                </div>
                <textarea className="input mono" rows={3} value={b.settingsText} onChange={(e) => patchBlock(b.id, { settingsText: e.target.value })} />
              </div>
            ))}
          </div>
          <datalist id="block-type-suggestions">
            {BLOCK_TYPE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}
          </datalist>
        </Drawer>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete "${deleteTarget.type}" section?`}
          body="This removes the section and all of its blocks from the template."
          confirmLabel="Delete section"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => removeSection(deleteTarget)}
        />
      )}
    </div>
  )
}