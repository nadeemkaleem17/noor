import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useSingleton } from '../../hooks/useCollection.js'
import { TextInput, NumberInput } from '../../components/Field.jsx'
import { Toggle, EmptyState } from '../../components/ui.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { makeId } from '../../lib/id.js'
import { useToast } from '../../context/toastContext.js'

const rupees = (money) => (money ? money.amount / 100 : '')
const toMoney = (v) => (v === '' || v === null || v === undefined ? undefined : { amount: Math.round(Number(v) * 100), currency: 'PKR' })

function CitiesInput({ zone, onChange }) {
  const [text, setText] = useState(zone.cities.join(', '))
  return (
    <TextInput
      label="Cities (comma-separated)" value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(text.split(',').map((c) => c.trim()).filter(Boolean))}
    />
  )
}

export default function Shipping() {
  const { value: saved, save } = useSingleton('storeConfig')
  const push = useToast()
  const [draft, setDraft] = useState(saved)
  const [prevSaved, setPrevSaved] = useState(saved)
  const [dirty, setDirty] = useState(false)

  if (saved !== prevSaved && !dirty) {
    setPrevSaved(saved)
    setDraft(saved)
  }

  if (!draft) return <div className="page"><p>Loading…</p></div>

  function patch(p) {
    setDraft((d) => ({ ...d, ...p }))
    setDirty(true)
  }
  function commit() {
    if (!save(draft)) return // rejected by the contract; stay dirty so nothing is lost
    setDirty(false)
    push('Shipping & payment settings saved', 'success')
  }

  const zones = draft.shipping?.zones || []
  const payments = draft.payments || []

  function patchZone(id, p) {
    patch({ shipping: { ...draft.shipping, zones: zones.map((z) => (z.id === id ? { ...z, ...p } : z)) } })
  }
  function removeZone(id) {
    patch({ shipping: { ...draft.shipping, zones: zones.filter((z) => z.id !== id) } })
  }
  function addZone() {
    patch({
      shipping: {
        ...draft.shipping,
        zones: [...zones, { id: makeId('z'), name: 'New zone', cities: [], methods: [{ id: makeId('sm'), label: 'Standard', fee: { amount: 25000, currency: 'PKR' }, etaDays: [3, 5] }] }],
      },
    })
  }
  function patchMethod(zoneId, methodId, p) {
    patchZone(zoneId, {
      methods: zones.find((z) => z.id === zoneId).methods.map((m) => (m.id === methodId ? { ...m, ...p } : m)),
    })
  }
  function removeMethod(zoneId, methodId) {
    patchZone(zoneId, { methods: zones.find((z) => z.id === zoneId).methods.filter((m) => m.id !== methodId) })
  }
  function addMethod(zoneId) {
    patchZone(zoneId, { methods: [...zones.find((z) => z.id === zoneId).methods, { id: makeId('sm'), label: 'New method', fee: { amount: 0, currency: 'PKR' }, etaDays: [3, 5] }] })
  }
  function togglePayment(id, enabled) {
    patch({ payments: payments.map((p) => (p.id === id ? { ...p, enabled } : p)) })
  }

  return (
    <div className="page">
      <PageHeader
        title="Shipping & payments"
        description="Delivery zones, per-zone shipping methods, the COD order limit, and which payment methods are offered at checkout."
        actions={<button className="btn primary" onClick={commit} disabled={!dirty}>{dirty ? 'Save changes' : 'Saved'}</button>}
      />

      <div className="section-title">Shipping zones</div>
      {zones.length === 0 && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <EmptyState title="No shipping zones" body="Add a zone to start charging shipping by city." />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 780 }}>
        {zones.map((zone) => (
          <div key={zone.id} className="card card-pad">
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <TextInput label="Zone name" value={zone.name} onChange={(e) => patchZone(zone.id, { name: e.target.value })} />
              </div>
              <div style={{ flex: 2 }}>
                <CitiesInput zone={zone} onChange={(cities) => patchZone(zone.id, { cities })} />
              </div>
              <button className="btn ghost icon sm" aria-label={`Delete ${zone.name}`} onClick={() => removeZone(zone.id)}><Trash2 size={13} /></button>
            </div>

            {zone.methods.map((m) => (
              <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <TextInput label="Method" value={m.label} onChange={(e) => patchMethod(zone.id, m.id, { label: e.target.value })} />
                </div>
                <div style={{ width: 130 }}>
                  <NumberInput label="Fee (Rs.)" value={rupees(m.fee)} onChange={(e) => patchMethod(zone.id, m.id, { fee: toMoney(e.target.value) || { amount: 0, currency: 'PKR' } })} />
                </div>
                <div style={{ width: 150 }}>
                  <NumberInput label="Free above (Rs.)" value={rupees(m.freeAbove)} onChange={(e) => patchMethod(zone.id, m.id, { freeAbove: toMoney(e.target.value) })} />
                </div>
                <div style={{ width: 90 }}>
                  <NumberInput label="ETA min (d)" value={m.etaDays?.[0] ?? ''} onChange={(e) => patchMethod(zone.id, m.id, { etaDays: [Number(e.target.value), m.etaDays?.[1] ?? Number(e.target.value)] })} />
                </div>
                <div style={{ width: 90 }}>
                  <NumberInput label="ETA max (d)" value={m.etaDays?.[1] ?? ''} onChange={(e) => patchMethod(zone.id, m.id, { etaDays: [m.etaDays?.[0] ?? Number(e.target.value), Number(e.target.value)] })} />
                </div>
                <button className="btn ghost icon sm" aria-label={`Delete ${m.label}`} onClick={() => removeMethod(zone.id, m.id)}><Trash2 size={13} /></button>
              </div>
            ))}
            <button className="btn secondary sm" onClick={() => addMethod(zone.id)}><Plus size={13} /> Add method</button>
          </div>
        ))}
        <button className="btn secondary" style={{ alignSelf: 'flex-start' }} onClick={addZone}><Plus size={15} /> Add zone</button>

        <div className="card card-pad" style={{ maxWidth: 300 }}>
          <NumberInput label="Cash-on-delivery order limit (Rs.)" value={rupees(draft.shipping?.codLimit)}
            onChange={(e) => patch({ shipping: { ...draft.shipping, codLimit: toMoney(e.target.value) } })} />
        </div>
      </div>

      <div className="divider" />

      <div className="section-title">Payment methods</div>
      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 500 }}>
        {payments.map((p) => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 13.5 }}>{p.label}</div>
              {p.description && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.description}</div>}
            </div>
            <Toggle checked={p.enabled} onChange={(v) => togglePayment(p.id, v)} label={p.label} />
          </div>
        ))}
      </div>
    </div>
  )
}