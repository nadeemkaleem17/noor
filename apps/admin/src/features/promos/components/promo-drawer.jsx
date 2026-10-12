import { ApiError, PromoInput, toFieldIssues } from '@noor/contract'
import { Badge } from '@noor/ui/badge'
import { Button } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { Combobox } from '@noor/ui/combobox'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { MoneyInput } from '@noor/ui/money-input'
import { NumberInput } from '@noor/ui/number-input'
import { RadioGroup } from '@noor/ui/radio-group'
import { Switch } from '@noor/ui/switch'
import { Textarea } from '@noor/ui/textarea'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { FormDrawer } from '@/components/form-drawer'
import { VariantPicker } from '@/components/variant-picker'
import { api } from '@/lib/api'
import { categoriesQuery, categoryOptions } from '@/lib/catalog'
import { messageFor } from '@/lib/errors'
import { formatMoney } from '@noor/i18n/format'
import { usePromoMutations } from '../api'
import { describePromo, emptyForm, generateCode, reasons, toBody, toForm } from '../promo-form'

/** @typedef {import('../promo-form').PromoForm} PromoForm */

const issueText = /** @type {Record<string, string>} */ ({
  required: 'Required.',
  code_invalid: 'Use 3 to 20 letters, numbers, hyphens or underscores.',
  invalid_format: 'This does not fit the rest of the rule.',
  too_small: 'Too small.',
  too_big: 'Too big.',
  not_unique: 'Each one only once.',
})
const text = (/** @type {string | undefined} */ code) => (code ? (issueText[code] ?? 'Check this value.') : undefined)

/** The kind of code, the words staff use. */
const types = [
  { value: 'percent', label: 'Percentage off' },
  { value: 'fixed', label: 'Fixed amount off' },
  { value: 'free_shipping', label: 'Free delivery' },
]
const scopes = [
  { value: 'all', label: 'Everything' },
  { value: 'categories', label: 'Categories (with their sub-categories)' },
  { value: 'products', label: 'Chosen products' },
]

/**
 * "Try this code": a cart is put together here and the server says whether the code applies and what it takes off. The browser works out nothing (plan/07-admin/07-promos.md section 4).
 * @param {{ body: object; valid: boolean }} props
 */
function TryIt({ body, valid }) {
  const { preview } = usePromoMutations()
  const [lines, setLines] = useState(/** @type {{ variantId: string; title: string; label: string; quantity: number }[]} */ ([]))
  const result = preview.data
  return (
    <fieldset className="space-y-3 rounded-control border border-line p-3">
      <legend className="px-1 text-sm font-medium">Try this code</legend>
      <p className="text-xs text-muted">Add a cart and see what the code would do. The shop works it out, as it will for a customer.</p>
      {lines.length ? (
        <ul className="divide-y divide-line text-sm">
          {lines.map((l, i) => (
            <li key={`${l.variantId}-${i}`} className="flex items-center justify-between gap-2 py-1">
              <span className="min-w-0">
                {l.title} <span className="text-muted">{l.label} × {l.quantity}</span>
              </span>
              <Button size="sm" variant="ghost" aria-label={`Remove ${l.title}`} iconStart={<Trash2 aria-hidden className="size-4" />} onClick={() => setLines((all) => all.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ul>
      ) : null}
      <VariantPicker onAdd={(l) => setLines((all) => [...all, { variantId: l.variantId, title: l.title, label: l.label, quantity: l.quantity }])} />
      <Button
        variant="secondary"
        disabled={!valid || lines.length === 0}
        loading={preview.isPending}
        onClick={() => preview.mutate(/** @type {never} */ ({ promo: body, lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) }))}
      >
        Try it
      </Button>
      {!valid ? <p className="text-xs text-muted">Finish the form first: the code is tried as it is written above.</p> : null}
      {preview.error ? <p role="alert" className="text-sm text-danger">{messageFor(preview.error)}</p> : null}
      {result ? (
        <p role="status" className="rounded-control bg-surface-2 p-3 text-sm">
          {result.applies ? (
            <>
              <Badge tone="success">Applies</Badge> It takes <strong>{formatMoney(result.discount, 'en')}</strong> off, from {formatMoney(result.eligibleSubtotal, 'en')} of the cart that it covers.
            </>
          ) : (
            <>
              <Badge tone="warning">Does not apply</Badge> {reasons[result.reason ?? ''] ?? result.reason}
            </>
          )}
        </p>
      ) : null}
    </fieldset>
  )
}

/**
 * The promo form in a drawer (plan/07-admin/07-promos.md section 3). Once an order has used the code, the code and the kind are fixed. The rule is read back in words as it is typed.
 * @param {{ promo: import('../api').AdminPromo | null; seed: PromoForm | null; onClose: () => void }} props
 */
export function PromoDrawer({ promo, seed, onClose }) {
  const toast = useToast()
  const { create, update } = usePromoMutations()
  const categories = useQuery(categoriesQuery)
  const [form, setForm] = useState(/** @type {PromoForm} */ (promo ? toForm(promo) : (seed ?? emptyForm())))
  const [labels, setLabels] = useState(/** @type {Record<string, string>} */ (Object.fromEntries((promo?.targets ?? []).map((t) => [t.id, t.label]))))
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}))
  const fixed = promo?.used === true

  /** @param {Partial<PromoForm>} patch */
  const set = (patch) => (setForm((f) => ({ ...f, ...patch })), setErrors({}))
  const body = toBody(form)
  const parsed = PromoInput.safeParse(body)
  const sentence = describePromo(form, labels)
  const categoryChoices = categories.data ? categoryOptions(/** @type {any} */ (categories.data.items)) : []

  /** The names of what is chosen: remember them so the sentence can say them. @param {string[]} ids @param {{ value: string; label: string }[]} known */
  const choose = (ids, known) => {
    setLabels((l) => ({ ...l, ...Object.fromEntries(known.filter((k) => ids.includes(k.value)).map((k) => [k.value, k.label])) }))
    set({ targetIds: ids })
  }

  async function searchProducts(/** @type {string} */ q) {
    if (q.trim().length < 2) return []
    const found = await api('admin.products.list', { query: /** @type {never} */ ({ q: q.trim(), size: 25, page: 1 }) })
    return found.items.map((p) => ({ value: p.id, label: p.title }))
  }

  async function save() {
    if (!parsed.success) {
      setErrors(Object.fromEntries(toFieldIssues(parsed.error).map((i) => [i.path.replace(/\.\d+$/, ''), i.code])))
      return
    }
    try {
      if (promo) await update.mutateAsync({ id: promo.id, body: /** @type {never} */ ({ ...parsed.data, version: promo.version }) })
      else await create.mutateAsync(/** @type {never} */ (parsed.data))
      toast.push({ title: `${parsed.data.code} saved`, tone: 'success' })
      onClose()
    } catch (e) {
      if (e instanceof ApiError && e.issues.length) setErrors(Object.fromEntries(e.issues.map((i) => [i.path, i.code])))
      else toast.push({ title: e instanceof ApiError && e.code === 'stale_write' ? 'Someone else changed this code. Close this panel and open it again.' : messageFor(e), tone: 'danger' })
    }
  }

  return (
    <FormDrawer open title={promo ? `Edit ${promo.code}` : 'New promo code'} onClose={onClose} formId="promo-form" saving={create.isPending || update.isPending} onSubmit={(e) => (e.preventDefault(), void save())}>
      <Field label="Code" required error={errors.code === 'not_unique' || errors.code === 'code_taken' ? 'This code already exists.' : text(errors.code)} hint={fixed ? 'Fixed: an order has used this code.' : '3 to 20 letters, numbers, - or _. Capitals are made for you.'}>
        <div className="flex gap-2">
          <Input value={form.code} readOnly={fixed} maxLength={20} dir="ltr" className="font-mono" onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} />
          {!fixed ? (
            <Button variant="secondary" onClick={() => set({ code: generateCode() })}>
              Generate
            </Button>
          ) : null}
        </div>
      </Field>

      <Field label="Kind" hint={fixed ? 'Fixed: an order has used this code.' : undefined}>
        <RadioGroup aria-label="Kind" options={types.map((t) => ({ ...t, disabled: fixed }))} value={form.type} onValueChange={(v) => set({ type: /** @type {PromoForm['type']} */ (v) })} />
      </Field>

      {form.type === 'percent' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Percent off" required error={text(errors.percent)} hint="1 to 90, whole numbers.">
            <NumberInput min={1} max={90} value={form.percent} onValueChange={(v) => set({ percent: v })} />
          </Field>
          <Field label="Most it may take off" error={text(errors.maxDiscount)} hint="Leave empty for no cap. A cap protects dear items.">
            <MoneyInput value={form.maxDiscount} onValueChange={(v) => set({ maxDiscount: v })} />
          </Field>
        </div>
      ) : null}
      {form.type === 'fixed' ? (
        <Field label="Amount off" required error={text(errors.amount)}>
          <MoneyInput value={form.amount} onValueChange={(v) => set({ amount: v })} />
        </Field>
      ) : null}

      <Field label="Minimum spend" error={text(errors.minSpend)} hint="Of the lines the code covers, before delivery.">
        <MoneyInput value={form.minSpend} onValueChange={(v) => set({ minSpend: v })} />
      </Field>

      <Field label="Applies to">
        <RadioGroup aria-label="Applies to" options={scopes} value={form.scope} onValueChange={(v) => set({ scope: /** @type {PromoForm['scope']} */ (v), targetIds: [] })} />
      </Field>
      {form.scope === 'categories' ? (
        <Field label="Categories" required error={text(errors.targetIds)}>
          <Combobox multiple aria-label="Categories" placeholder="Choose categories" options={categoryChoices} value={form.targetIds} onValueChange={(ids) => choose(ids, categoryChoices)} />
        </Field>
      ) : null}
      {form.scope === 'products' ? (
        <Field label="Products" required error={text(errors.targetIds)} hint="Type two letters of the title to search.">
          <Combobox
            multiple
            aria-label="Products"
            placeholder="Search products"
            options={form.targetIds.map((id) => ({ value: id, label: labels[id] ?? id }))}
            onSearch={async (q) => {
              const found = await searchProducts(q)
              setLabels((l) => ({ ...l, ...Object.fromEntries(found.map((f) => [f.value, f.label])) }))
              return found
            }}
            value={form.targetIds}
            onValueChange={(ids) => set({ targetIds: ids })}
          />
        </Field>
      ) : null}

      <Checkbox label="Leave sale items out (lines with a compare-at price)" checked={form.excludeSaleItems} onCheckedChange={(v) => set({ excludeSaleItems: v })} />
      <Checkbox label="First order only" checked={form.firstOrderOnly} onCheckedChange={(v) => set({ firstOrderOnly: v })} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Uses in all" error={text(errors.usageLimit)} hint="Leave empty for no limit.">
          <NumberInput min={1} value={form.usageLimit} onValueChange={(v) => set({ usageLimit: v })} />
        </Field>
        <Field label="Uses per customer" error={text(errors.perCustomerLimit)} hint="By phone number.">
          <NumberInput min={1} value={form.perCustomerLimit} onValueChange={(v) => set({ perCustomerLimit: v })} />
        </Field>
        <Field label="Starts" hint="Pakistan time. Empty: now.">
          <Input type="datetime-local" value={form.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
        </Field>
        <Field label="Ends" error={text(errors.endsAt)} hint="Empty: no end.">
          <Input type="datetime-local" value={form.endsAt} onChange={(e) => set({ endsAt: e.target.value })} />
        </Field>
      </div>

      <Switch label="Enabled" checked={form.enabled} onCheckedChange={(v) => set({ enabled: v })} />
      <Field label="Internal note" hint="Why the code exists: a campaign, a goodwill gesture.">
        <Textarea rows={2} maxLength={300} value={form.note} onChange={(e) => set({ note: e.target.value })} />
      </Field>

      <p role="status" aria-label="The rule" className="rounded-control bg-surface-2 p-3 text-sm">
        {sentence || 'Fill in the kind and the value to see the rule in words.'}
      </p>

      <TryIt body={body} valid={parsed.success} />
    </FormDrawer>
  )
}
