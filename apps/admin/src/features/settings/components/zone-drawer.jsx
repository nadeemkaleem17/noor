import { ApiError, ZoneInput } from '@noor/contract'
import { Button, IconButton } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { Field, RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { MoneyInput } from '@noor/ui/money-input'
import { NumberInput } from '@noor/ui/number-input'
import { Switch } from '@noor/ui/switch'
import { Textarea } from '@noor/ui/textarea'
import { useToast } from '@noor/ui/toast'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { FormDrawer } from '@/components/form-drawer'
import { messageFor } from '@/lib/errors'
import { contractResolver, prune } from '@/lib/form'
import { useZoneMutations } from '../api'

/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').AdminZone>} Zone */
/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').AdminCity>} City */

const newMethod = () => ({ label: '', fee: { amount: 0, currency: /** @type {const} */ ('PKR') }, freeAbove: undefined, etaMinDays: 2, etaMaxDays: 4, codAllowed: true, enabled: true })

/** How many cities the picker draws at once; the search box narrows the rest. */
const shown = 80

/**
 * The cities of a zone: tick to include, search to find, paste a list to add many (plan/07-admin/10-shipping-payments.md section 2.1).
 * A city that is in another zone shows that zone's name and can be moved here, never duplicated.
 * @param {{ cities: City[]; zoneId?: string; value: string[]; onChange: (ids: string[]) => void; error?: string; }} props
 */
function CityPicker({ cities, zoneId, value, onChange, error }) {
  const { match } = useZoneMutations()
  const [q, setQ] = useState('')
  const [pasted, setPasted] = useState('')
  const chosen = new Set(value)
  const needle = q.trim().toLowerCase()
  const found = cities.filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.aliases.some((a) => a.toLowerCase().includes(needle)))
  const toggle = (/** @type {string} */ id, /** @type {boolean} */ on) => onChange(on ? [...value, id] : value.filter((v) => v !== id))

  async function addPasted() {
    const names = pasted.split(/[\n,]/).map((n) => n.trim()).filter(Boolean)
    if (names.length === 0) return
    const { matched, unknown } = await match.mutateAsync(names.slice(0, 500))
    onChange([...new Set([...value, ...matched.map((m) => m.city.id)])])
    setPasted(unknown.join('\n')) // what is left is what needs correcting
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Cities</legend>
      <p className="text-sm text-muted">
        {value.length} {value.length === 1 ? 'city' : 'cities'} in this zone. A city is in one zone only; moving one here takes it out of its old zone.
      </p>
      <Field label="Search cities">
        <Input value={q} onChange={(e) => setQ(e.target.value)} />
      </Field>
      <ul className="max-h-60 space-y-1 overflow-y-auto rounded-control border border-line p-2">
        {found.slice(0, shown).map((c) => {
          const elsewhere = c.zone && c.zone.id !== zoneId ? c.zone.name : null
          const on = chosen.has(c.id)
          return (
            <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
              {elsewhere && !on ? (
                <>
                  <span>
                    {c.name} <span className="text-muted">is in {elsewhere}</span>
                  </span>
                  <Button variant="link" aria-label={`Move ${c.name} here`} onClick={() => toggle(c.id, true)}>
                    Move here
                  </Button>
                </>
              ) : (
                <Checkbox label={elsewhere ? `${c.name} (moves from ${elsewhere})` : c.name} checked={on} onCheckedChange={(next) => toggle(c.id, Boolean(next))} />
              )}
            </li>
          )
        })}
        {found.length === 0 ? <li className="text-sm text-muted">No city matches.</li> : null}
        {found.length > shown ? <li className="text-xs text-muted">{found.length - shown} more. Search to narrow the list.</li> : null}
      </ul>
      <Field label="Paste a list" hint="One city per line, or separated by commas.">
        <Textarea rows={3} value={pasted} onChange={(e) => setPasted(e.target.value)} />
      </Field>
      <Button variant="secondary" size="sm" loading={match.isPending} onClick={() => void addPasted()}>
        Add the pasted cities
      </Button>
      {match.isSuccess && match.data.unknown.length > 0 ? (
        <p role="status" className="text-sm text-danger">
          Not in the city list: {match.data.unknown.join(', ')}. They are left in the box so you can correct them.
        </p>
      ) : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </fieldset>
  )
}

/**
 * Create or edit a zone. Before a change that takes cities out of this zone or pulls them in from another, the server's impact count is shown for confirmation.
 * @param {{ open: boolean; zone: Zone | null; cities: City[]; onClose: () => void; }} props
 */
export function ZoneDrawer({ open, zone, cities, onClose }) {
  const { create, update, impact } = useZoneMutations()
  const toast = useToast()
  const [confirm, setConfirm] = useState(/** @type {{ removed: number; moved: { city: string; fromZone: string; }[]; carts: number; } | null} */ (null))
  const memberIds = zone ? cities.filter((c) => c.zone?.id === zone.id).map((c) => c.id) : []
  const form = useForm({
    defaultValues: { name: zone?.name ?? '', cityIds: memberIds, methods: zone ? zone.methods.map((m) => ({ ...m })) : [newMethod()] },
    resolver: contractResolver(ZoneInput, (/** @type {any} */ v) => body(v)),
  })
  const methods = useFieldArray({ control: form.control, name: 'methods', keyName: 'rid' })
  const cityIds = /** @type {string[]} */ (useWatch({ control: form.control, name: 'cityIds' }))

  /** @param {any} v @returns {any} */
  const body = (v) => prune({ name: v.name, cityIds: v.cityIds, methods: v.methods.map((/** @type {any} */ m) => ({ id: m.id, label: m.label, fee: m.fee, freeAbove: m.freeAbove, etaMinDays: m.etaMinDays, etaMaxDays: m.etaMaxDays, codAllowed: m.codAllowed, enabled: m.enabled })) })

  async function persist() {
    try {
      const doc = body(form.getValues())
      if (zone) await update.mutateAsync({ id: zone.id, body: { ...doc, version: zone.version } })
      else await create.mutateAsync(doc)
      toast.push({ title: 'Zone saved', tone: 'success' })
      setConfirm(null)
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.issues.length > 0) for (const issue of error.issues) form.setError(/** @type {never} */ (issue.path), { type: issue.code, message: issue.code })
      else toast.push({ title: error instanceof ApiError && error.code === 'no_deliverable_city' ? 'This would leave no city that customers can order to.' : messageFor(error), tone: 'danger' })
      setConfirm(null)
    }
  }

  async function submit() {
    if (!zone) return persist()
    try {
      const { citiesRemoved, citiesMovedIn, openCarts } = await impact.mutateAsync({ id: zone.id, body: body(form.getValues()) })
      if (citiesRemoved > 0 || citiesMovedIn.length > 0) setConfirm({ removed: citiesRemoved, moved: citiesMovedIn, carts: openCarts })
      else await persist()
    } catch (error) {
      toast.push({ title: messageFor(error), tone: 'danger' })
    }
  }

  return (
    <>
      <FormDrawer open={open} title={zone ? `Edit ${zone.name}` : 'New zone'} onClose={onClose} formId="zone-form" saving={create.isPending || update.isPending || impact.isPending} onSubmit={(e) => void form.handleSubmit(submit)(e)}>
        <RHFField control={form.control} name="name" label="Name" required hint="Only staff see this name.">
          {(field) => <Input {...field} maxLength={60} required />}
        </RHFField>
        <Controller control={form.control} name="cityIds" render={({ fieldState }) => <CityPicker cities={cities} zoneId={zone?.id} value={cityIds} onChange={(ids) => form.setValue('cityIds', ids, { shouldDirty: true })} error={fieldState.error ? 'Choose cities that are in this zone.' : undefined} />} />

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Delivery methods</legend>
          {methods.fields.map((f, i) => (
            <div key={f.rid} className="space-y-2 rounded-control border border-line p-2">
              <div className="flex items-end gap-2">
                <RHFField control={form.control} name={`methods.${i}.label`} label={`Method ${i + 1} name`} required className="flex-1" hint="Shown to customers.">
                  {(field) => <Input {...field} maxLength={60} required />}
                </RHFField>
                <IconButton label={`Move method ${i + 1} up`} icon={<ArrowUp aria-hidden className="size-4" />} disabled={i === 0} onClick={() => methods.move(i, i - 1)} />
                <IconButton label={`Move method ${i + 1} down`} icon={<ArrowDown aria-hidden className="size-4" />} disabled={i === methods.fields.length - 1} onClick={() => methods.move(i, i + 1)} />
                <IconButton label={`Remove method ${i + 1}`} icon={<Trash2 aria-hidden className="size-4" />} disabled={methods.fields.length === 1} onClick={() => methods.remove(i)} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <RHFField control={form.control} name={`methods.${i}.fee`} label={`Fee for method ${i + 1}`}>
                  {(field) => <MoneyInput name={field.name} ref={field.ref} onBlur={field.onBlur} invalid={field.invalid} value={field.value ?? null} onValueChange={(m) => field.onChange(m)} />}
                </RHFField>
                <RHFField control={form.control} name={`methods.${i}.freeAbove`} label={`Free above, method ${i + 1}`} hint="Order total after discount at or above this has no fee.">
                  {(field) => <MoneyInput name={field.name} ref={field.ref} onBlur={field.onBlur} invalid={field.invalid} value={field.value ?? null} onValueChange={(m) => field.onChange(m)} />}
                </RHFField>
                <RHFField control={form.control} name={`methods.${i}.etaMinDays`} label={`Fastest days, method ${i + 1}`}>
                  {(field) => <NumberInput name={field.name} ref={field.ref} onBlur={field.onBlur} invalid={field.invalid} min={0} max={60} value={field.value ?? null} onValueChange={(n) => field.onChange(n)} />}
                </RHFField>
                <RHFField control={form.control} name={`methods.${i}.etaMaxDays`} label={`Slowest days, method ${i + 1}`}>
                  {(field) => <NumberInput name={field.name} ref={field.ref} onBlur={field.onBlur} invalid={field.invalid} min={0} max={60} value={field.value ?? null} onValueChange={(n) => field.onChange(n)} />}
                </RHFField>
              </div>
              <div className="flex flex-wrap gap-4">
                <Controller control={form.control} name={`methods.${i}.codAllowed`} render={({ field }) => <Checkbox label="Cash on delivery available" checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
                <Controller control={form.control} name={`methods.${i}.enabled`} render={({ field }) => <Switch label="Enabled" checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
              </div>
            </div>
          ))}
          {form.formState.errors.methods?.message || form.formState.errors.methods?.root ? (
            <p role="alert" className="text-sm text-danger">
              A zone needs at least one enabled method.
            </p>
          ) : null}
          {methods.fields.length < 4 ? (
            <Button variant="secondary" size="sm" iconStart={<Plus aria-hidden className="size-4" />} onClick={() => methods.append(newMethod())}>
              Add a method
            </Button>
          ) : null}
        </fieldset>
      </FormDrawer>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(next) => !next && setConfirm(null)}
        tone="accent"
        title="This changes which cities are in the zone"
        confirmLabel="Save the zone"
        onConfirm={persist}
        body={
          confirm ? (
            <div className="space-y-2 text-sm">
              {confirm.removed > 0 ? <p>{confirm.removed} {confirm.removed === 1 ? 'city leaves' : 'cities leave'} this zone and can no longer be ordered to until another zone takes {confirm.removed === 1 ? 'it' : 'them'}.</p> : null}
              {confirm.moved.length > 0 ? (
                <p>
                  Moved here from other zones: {confirm.moved.map((m) => `${m.city} (from ${m.fromZone})`).join(', ')}.
                </p>
              ) : null}
              <p>{confirm.carts} open carts and 0 open orders use these cities. Open orders keep the fee they were placed with.</p>
            </div>
          ) : null
        }
      />
    </>
  )
}
