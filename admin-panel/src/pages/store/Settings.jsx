import { useState } from 'react'
import { Plus, Trash2, RotateCcw } from 'lucide-react'
import { useSingleton } from '../../hooks/useCollection.js'
import { TextInput, SelectInput, CheckboxRow } from '../../components/Field.jsx'
import { Toggle, ConfirmDialog } from '../../components/ui.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { makeId } from '../../lib/id.js'
import { resetAllData } from '../../lib/db.js'
import { useToast } from '../../context/toastContext.js'

const TABS = ['Brand', 'Locale & pricing', 'Notices', 'Contact', 'Checkout & features', 'Policies']
const FEATURE_LABELS = {
  wishlist: 'Wishlist', reviews: 'Reviews', notifyMe: 'Notify me (back in stock)',
  customSizing: 'Custom sizing', findMySize: 'Find my size', compare: 'Compare products', multiCurrency: 'Multi-currency',
}

export default function Settings() {
  const { value: saved, save } = useSingleton('storeConfig')
  const push = useToast()
  const [draft, setDraft] = useState(saved)
  const [prevSaved, setPrevSaved] = useState(saved)
  const [tab, setTab] = useState('Brand')
  const [dirty, setDirty] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  // Resetting local state synchronously during render (not in an effect) when the
  // underlying singleton changes — same pattern as the storefront's Product.jsx.
  if (saved !== prevSaved && !dirty) {
    setPrevSaved(saved)
    setDraft(saved)
  }

  if (!draft) return <div className="page"><p>Loading store settings…</p></div>

  function patch(p) {
    setDraft((d) => ({ ...d, ...p }))
    setDirty(true)
  }
  function commit() {
    if (!save(draft)) return // rejected by the contract; stay dirty so nothing is lost
    setDirty(false)
    push('Store settings saved', 'success')
  }

  return (
    <div className="page">
      <PageHeader
        title="Store settings"
        description="Everything here comes from the shared StoreConfig contract — the same shape the storefront's BFF will read once it's connected (see doc, Part C)."
        actions={<button className="btn primary" onClick={commit} disabled={!dirty}>{dirty ? 'Save changes' : 'Saved'}</button>}
      />

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Brand' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
          <div className="form-grid">
            <TextInput label="Store name" value={draft.brand.name} onChange={(e) => patch({ brand: { ...draft.brand, name: e.target.value } })} />
            <TextInput label="Tagline" value={draft.brand.tagline || ''} onChange={(e) => patch({ brand: { ...draft.brand, tagline: e.target.value } })} />
          </div>
          <TextInput label="Logo URL (light)" value={draft.brand.logo?.light || ''} onChange={(e) => patch({ brand: { ...draft.brand, logo: { ...draft.brand.logo, light: e.target.value } } })} />
        </div>
      )}

      {tab === 'Locale & pricing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
          <div className="form-grid cols-3">
            <TextInput label="Default locale" value={draft.locale.default} onChange={(e) => patch({ locale: { ...draft.locale, default: e.target.value } })} />
            <TextInput label="Currency" value={draft.locale.currency} onChange={(e) => patch({ locale: { ...draft.locale, currency: e.target.value.toUpperCase() } })} />
            <SelectInput label="Direction" value={draft.locale.direction} onChange={(e) => patch({ locale: { ...draft.locale, direction: e.target.value } })}
              options={[{ value: 'ltr', label: 'Left to right' }, { value: 'rtl', label: 'Right to left' }]} />
          </div>
          <div className="form-grid">
            <SelectInput label="Price rounding" value={draft.priceDisplay.rounding} onChange={(e) => patch({ priceDisplay: { ...draft.priceDisplay, rounding: e.target.value } })}
              options={[{ value: 'none', label: 'None' }, { value: 'nearest', label: 'Nearest' }, { value: 'up', label: 'Round up' }]} />
            <div className="field">
              <label>Show decimals</label>
              <Toggle checked={draft.priceDisplay.showDecimals} onChange={(v) => patch({ priceDisplay: { ...draft.priceDisplay, showDecimals: v } })} label="Show decimals" />
            </div>
          </div>
        </div>
      )}

      {tab === 'Notices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 680 }}>
          {draft.notices.map((n) => (
            <div key={n.id} className="card card-pad" style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <TextInput label="Text" value={n.text} onChange={(e) => patch({ notices: draft.notices.map((x) => (x.id === n.id ? { ...x, text: e.target.value } : x)) })} />
              </div>
              <div style={{ width: 160 }}>
                <SelectInput label="Severity" value={n.severity} onChange={(e) => patch({ notices: draft.notices.map((x) => (x.id === n.id ? { ...x, severity: e.target.value } : x)) })}
                  options={[{ value: 'info', label: 'Info' }, { value: 'promo', label: 'Promo' }, { value: 'notice', label: 'Notice' }]} />
              </div>
              <button className="btn ghost icon sm" onClick={() => patch({ notices: draft.notices.filter((x) => x.id !== n.id) })}><Trash2 size={13} /></button>
            </div>
          ))}
          <button className="btn secondary" style={{ alignSelf: 'flex-start' }}
            onClick={() => patch({ notices: [...draft.notices, { id: makeId('n'), text: 'New notice', severity: 'info' }] })}>
            <Plus size={15} /> Add notice
          </button>
        </div>
      )}

      {tab === 'Contact' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
          <div className="form-grid">
            <TextInput label="WhatsApp (92…)" value={draft.contact.whatsapp} onChange={(e) => patch({ contact: { ...draft.contact, whatsapp: e.target.value } })} />
            <TextInput label="Phone" value={draft.contact.phone} onChange={(e) => patch({ contact: { ...draft.contact, phone: e.target.value } })} />
          </div>
          <div className="form-grid">
            <TextInput label="Email" value={draft.contact.email} onChange={(e) => patch({ contact: { ...draft.contact, email: e.target.value } })} />
            <TextInput label="Address" value={draft.contact.address} onChange={(e) => patch({ contact: { ...draft.contact, address: e.target.value } })} />
          </div>
        </div>
      )}

      {tab === 'Checkout & features' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>
          <div className="field">
            <CheckboxRow label="Allow guest checkout" checked={draft.checkout.guest} onChange={(v) => patch({ checkout: { ...draft.checkout, guest: v } })} />
          </div>
          <div>
            <div className="section-title">Feature flags</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 360 }}>
                  <span style={{ fontSize: 13.5 }}>{label}</span>
                  <Toggle checked={!!draft.features?.[key]} onChange={(v) => patch({ features: { ...draft.features, [key]: v } })} label={label} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'Policies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
          <p className="hint">These reference CMS page slugs (see the Pages screen) rather than storing the policy text twice.</p>
          <div className="form-grid">
            <TextInput label="Returns policy — page slug" value={draft.policies?.returns || ''} onChange={(e) => patch({ policies: { ...draft.policies, returns: e.target.value } })} />
            <TextInput label="Shipping policy — page slug" value={draft.policies?.shipping || ''} onChange={(e) => patch({ policies: { ...draft.policies, shipping: e.target.value } })} />
          </div>
          <div className="form-grid">
            <TextInput label="Privacy policy — page slug" value={draft.policies?.privacy || ''} onChange={(e) => patch({ policies: { ...draft.policies, privacy: e.target.value } })} />
            <TextInput label="Terms — page slug" value={draft.policies?.terms || ''} onChange={(e) => patch({ policies: { ...draft.policies, terms: e.target.value } })} />
          </div>
        </div>
      )}

      <div className="divider" />
      <div className="card card-pad" style={{ maxWidth: 640, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, borderColor: 'var(--danger-soft)' }}>
        <div>
          <div className="section-title" style={{ marginBottom: 4 }}>Danger zone</div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            Wipes every collection in this admin panel — products, orders, promos, reviews, CMS pages, menus, templates
            and store settings — back to the seed fixtures. Cannot be undone.
          </p>
        </div>
        <button className="btn danger" style={{ flexShrink: 0 }} onClick={() => setConfirmReset(true)}>
          <RotateCcw size={14} /> Reset demo data
        </button>
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="Reset all demo data?"
          body="This overwrites everything in this admin panel with the original seed data and reloads the page. Any edits you've made will be lost."
          confirmLabel="Reset everything"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            resetAllData()
            push('Demo data reset', 'success')
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}