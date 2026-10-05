import { useState } from 'react'
import { Plus, Trash2, ExternalLink } from 'lucide-react'
import { useCollection } from '../../hooks/useCollection.js'
import { Drawer, ConfirmDialog, StatusPill, EmptyState } from '../../components/ui.jsx'
import { TextInput, TextArea, SelectInput } from '../../components/Field.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { slugify, slugifyLoose } from '../../lib/id.js'

import { useToast } from '../../context/toastContext.js'

export default function Pages() {
  const { items: pages, create, update, remove } = useCollection('pages')
  const push = useToast()
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  function openNew() {
    setEditing({ isNew: true, slug: '', title: '', status: 'draft', bodyMd: '', seo: { title: '', description: '' } })
  }
  function save() {
    if (!editing.title || !editing.slug) {
      push('Title and slug are required', 'danger')
      return
    }
    const payload = { ...editing, isNew: undefined }
    const saved = editing.isNew ? create(payload, 'pg') : update(editing.id, payload)
    if (!saved) return
    push('Page saved', 'success')
    setEditing(null)
  }

  return (
    <div className="page">
      <PageHeader
        title="CMS pages"
        description="Static content pages the storefront renders at /pages/:slug — About, Contact, Returns, Shipping, etc."
        actions={<button className="btn primary" onClick={openNew}><Plus size={15} /> New page</button>}
      />

      {pages.length === 0 ? (
        <div className="card card-pad">
          <EmptyState title="No pages yet" body="Create your first static page." action={<button className="btn primary" onClick={openNew}>New page</button>} />
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="grid">
            <thead><tr><th>Title</th><th>Slug</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {pages.map((pg) => (
                <tr key={pg.id} className="clickable" onClick={() => setEditing(pg)}>
                  <td style={{ fontWeight: 500 }}>{pg.title}</td>
                  <td className="mono">/pages/{pg.slug}</td>
                  <td><StatusPill status={pg.status} /></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className="btn ghost icon sm" onClick={() => setDeleteTarget(pg)}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Drawer
          title={editing.title || 'New page'}
          subtitle={editing.slug ? `/pages/${editing.slug}` : undefined}
          onClose={() => setEditing(null)}
          width={560}
          footer={<><button className="btn secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}
        >
          <div className="form-grid">
            <TextInput label="Title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value, slug: editing.isNew ? slugify(e.target.value) : editing.slug })} />
            <TextInput label="Slug" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: slugifyLoose(e.target.value) })} onBlur={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })} hint="Live at /pages/…" />
          </div>
          <SelectInput label="Status" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}
            options={[{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }]} />
          <TextArea label="Body (Markdown)" rows={10} value={editing.bodyMd} onChange={(e) => setEditing({ ...editing, bodyMd: e.target.value })} />
          <div className="divider" />
          <div className="section-title">SEO</div>
          <TextInput label="SEO title" value={editing.seo?.title || ''} onChange={(e) => setEditing({ ...editing, seo: { ...editing.seo, title: e.target.value } })} />
          <TextArea label="SEO description" rows={2} value={editing.seo?.description || ''} onChange={(e) => setEditing({ ...editing, seo: { ...editing.seo, description: e.target.value } })} />
          {!editing.isNew && (
            <a className="btn secondary" href={`https://example-storefront.test/pages/${editing.slug}`} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start' }}>
              <ExternalLink size={14} /> Preview on storefront
            </a>
          )}
        </Drawer>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete "${deleteTarget.title}"?`}
          body="The storefront will 404 on this page's URL once deleted."
          confirmLabel="Delete page"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { remove(deleteTarget.id); push('Page deleted', 'danger'); setDeleteTarget(null) }}
        />
      )}
    </div>
  )
}