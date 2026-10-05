import { PaymentSettings, StoreSettings, money, z } from '@noor/contract'
import { Badge } from '@noor/ui/badge'
import { IconButton } from '@noor/ui/button'
import { ErrorState } from '@noor/ui/error-state'
import { RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { MoneyInput } from '@noor/ui/money-input'
import { Spinner } from '@noor/ui/spinner'
import { Switch } from '@noor/ui/switch'
import { Textarea } from '@noor/ui/textarea'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Controller } from 'react-hook-form'
import { PageHeader } from '@/components/page-header'
import { SectionCard } from '@/components/section-card'
import { messageFor } from '@/lib/errors'
import { useCan } from '@/lib/session'
import { paymentsQuery, storeQuery, useSavePayments, useSaveStoreSlice } from '../api'
import { SettingsCard } from './settings-card'

/** @typedef {import('@noor/contract').PaymentSettings['methods'][number]} Method */
/** @typedef {import('@noor/contract').PaymentMethod} PaymentMethod */

const defaults = /** @type {Record<PaymentMethod, string>} */ ({ cod: 'Cash on delivery', bank_transfer: 'Bank transfer', wallet: 'Mobile wallet', card: 'Card', bnpl: 'Buy now, pay later' })
const M = PaymentSettings.shape.methods.element.shape
const text = (/** @type {import('react-hook-form').ControllerRenderProps<any, any>} */ field) => ({ ...field, value: field.value ?? '' })

/** The stored entry for a method, or the standing default when it was never saved. @param {{ methods: Method[]; }} value @param {PaymentMethod} type @returns {Method} */
const methodOf = (value, type) => value.methods.find((m) => m.type === type) ?? { type, enabled: false, label: defaults[type], sortOrder: value.methods.length }

/** Replaces one method's fields, keeping the rest of the document. @param {{ methods: Method[]; }} value @param {PaymentMethod} type @param {Partial<Method>} patch */
function withMethod(value, type, patch) {
  const next = { ...methodOf(value, type), ...patch }
  return { ...value, methods: value.methods.some((m) => m.type === type) ? value.methods.map((m) => (m.type === type ? next : m)) : [...value.methods, next] }
}

/** How many methods are on in the saved document, and whether this is one of them: the last one on cannot be switched off. @param {{ methods: Method[]; }} value @param {PaymentMethod} type */
const isLastOn = (value, type) => value.methods.filter((m) => m.enabled).length === 1 && methodOf(value, type).enabled

/**
 * The on/off switch of a method. The only method that is on stays on: the shop must always have a way to pay (plan/07-admin/10-shipping-payments.md section 3).
 * @param {{ form: import('react-hook-form').UseFormReturn<any>; writable: boolean; locked: boolean; label: string; }} props
 */
function EnabledSwitch({ form, writable, locked, label }) {
  return (
    <Controller
      control={form.control}
      name="enabled"
      render={({ field }) => (
        <div>
          <Switch label={label} checked={Boolean(field.value)} disabled={!writable || locked} onCheckedChange={field.onChange} />
          {locked ? <p className="mt-1 text-xs text-muted">It is the only payment method that is on. Turn another one on before turning this one off.</p> : null}
        </div>
      )}
    />
  )
}

/** The label and description customers read at checkout. @param {{ form: import('react-hook-form').UseFormReturn<any>; writable: boolean; }} props */
function WordingFields({ form, writable }) {
  return (
    <>
      <RHFField control={form.control} name="label" label="Name at checkout" required>
        {(field) => <Input {...field} maxLength={40} required readOnly={!writable} />}
      </RHFField>
      <RHFField control={form.control} name="description" label="Description" hint="A short line under the name at checkout.">
        {(field) => <Textarea {...text(field)} rows={2} maxLength={200} readOnly={!writable} />}
      </RHFField>
    </>
  )
}

const moneyFrom = (/** @type {number | undefined} */ minor) => (minor === undefined ? null : money(minor))

/** @param {{ value: any; high: number; }} props */
function CodCard({ value, high }) {
  const save = useSavePayments()
  const saveStore = useSaveStoreSlice()
  const cod = methodOf(value, 'cod')
  const schema = z.strictObject({ enabled: z.boolean(), label: M.label, description: M.description, codLimitMinor: PaymentSettings.shape.codLimitMinor, highValueCodMinor: StoreSettings.shape.thresholds.shape.highValueCodMinor })
  return (
    <SettingsCard
      id="cod"
      title="Cash on delivery"
      defaults={{ enabled: cod.enabled, label: cod.label, description: cod.description ?? '', codLimit: moneyFrom(value.codLimitMinor), highValue: money(high) }}
      schema={schema}
      toValue={(f) => ({ enabled: f.enabled, label: f.label, description: f.description?.trim() || undefined, codLimitMinor: f.codLimit?.amount, highValueCodMinor: f.highValue?.amount })}
      errorPath={(p) => (p === 'codLimitMinor' ? 'codLimit' : p === 'highValueCodMinor' ? 'highValue' : p)}
      save={async (v) => {
        const { highValueCodMinor, codLimitMinor, ...patch } = /** @type {any} */ (v)
        await save.mutateAsync((latest) => ({ ...withMethod(latest, 'cod', patch), codLimitMinor }))
        if (highValueCodMinor !== high) await saveStore.mutateAsync((latest) => ({ thresholds: { ...latest.thresholds, highValueCodMinor } }))
      }}
    >
      {(form, writable) => (
        <>
          <EnabledSwitch form={form} writable={writable} locked={isLastOn(value, 'cod')} label="Accept cash on delivery" />
          <WordingFields form={form} writable={writable} />
          <div className="grid gap-3 sm:grid-cols-2">
            <RHFField control={form.control} name="codLimit" label="Order limit" hint="Orders above this cannot be paid by cash on delivery. Leave empty for no limit.">
              {(field) => <MoneyInput name={field.name} ref={field.ref} onBlur={field.onBlur} invalid={field.invalid} readOnly={!writable} value={field.value ?? null} onValueChange={(m) => field.onChange(m)} />}
            </RHFField>
            <RHFField control={form.control} name="highValue" label="High-value order" required hint="Orders at or above this are marked for extra care.">
              {(field) => <MoneyInput name={field.name} ref={field.ref} onBlur={field.onBlur} invalid={field.invalid} readOnly={!writable} value={field.value ?? null} onValueChange={(m) => field.onChange(m)} />}
            </RHFField>
          </div>
          <p className="text-sm text-muted">Every cash on delivery order is confirmed with the customer before it is dispatched. This is always on, because it stops orders that nobody will accept at the door.</p>
          <p className="text-sm text-muted">While only cash on delivery is on, deposits for made-to-order items are collected by staff and recorded on the order before it is confirmed.</p>
        </>
      )}
    </SettingsCard>
  )
}

const bankFields = /** @type {const} */ ([
  ['accountTitle', 'Account title', 100],
  ['bank', 'Bank', 100],
  ['accountNumber', 'Account number or IBAN', 40],
])

/** @param {{ value: any; }} props */
function BankCard({ value }) {
  const save = useSavePayments()
  const bank = methodOf(value, 'bank_transfer')
  const b = value.bankTransfer
  const schema = z.strictObject({ enabled: z.boolean(), label: M.label, description: M.description, bankTransfer: PaymentSettings.shape.bankTransfer })
  return (
    <SettingsCard
      id="bank_transfer"
      title="Bank transfer"
      defaults={{ enabled: bank.enabled, label: bank.label, description: bank.description ?? '', bankTransfer: { accountTitle: b?.accountTitle ?? '', bank: b?.bank ?? '', accountNumber: b?.accountNumber ?? '', instructions: b?.instructions ?? '' } }}
      schema={schema}
      toValue={(f) => {
        const t = f.bankTransfer
        const any = Object.values(t).some((v) => String(v).trim() !== '')
        // account details are all or nothing: turning the method on needs every one of them
        return { enabled: f.enabled, label: f.label, description: f.description?.trim() || undefined, bankTransfer: f.enabled || any ? t : undefined }
      }}
      save={(v) => {
        const { bankTransfer, ...patch } = /** @type {any} */ (v)
        return save.mutateAsync((latest) => ({ ...withMethod(latest, 'bank_transfer', patch), bankTransfer }))
      }}
    >
      {(form, writable) => (
        <>
          <EnabledSwitch form={form} writable={writable} locked={isLastOn(value, 'bank_transfer')} label="Accept bank transfer" />
          <WordingFields form={form} writable={writable} />
          {bankFields.map(([key, label, max]) => (
            <RHFField key={key} control={form.control} name={`bankTransfer.${key}`} label={label} hint={key === 'accountNumber' ? 'Customers see this to send their payment. It is not a secret.' : undefined}>
              {(field) => <Input {...field} maxLength={max} readOnly={!writable} />}
            </RHFField>
          ))}
          <RHFField control={form.control} name="bankTransfer.instructions" label="Instructions" hint="Shown on the order page and in the WhatsApp message.">
            {(field) => <Textarea {...text(field)} rows={3} maxLength={300} readOnly={!writable} />}
          </RHFField>
        </>
      )}
    </SettingsCard>
  )
}

/** A method with nothing behind it yet: shown, but it cannot be turned on until its integration is installed. @param {{ type: PaymentMethod; value: any; configured: boolean; }} props */
function OtherCard({ type, value, configured }) {
  const save = useSavePayments()
  const method = methodOf(value, type)
  const schema = z.strictObject({ enabled: z.boolean(), label: M.label, description: M.description })
  return (
    <SettingsCard
      id={type}
      title={defaults[type]}
      defaults={{ enabled: method.enabled, label: method.label, description: method.description ?? '' }}
      schema={schema}
      toValue={(f) => ({ enabled: f.enabled, label: f.label, description: f.description?.trim() || undefined })}
      save={(v) => save.mutateAsync((latest) => withMethod(latest, type, /** @type {any} */ (v)))}
    >
      {(form, writable) =>
        configured ? (
          <>
            <EnabledSwitch form={form} writable={writable} locked={isLastOn(value, type)} label={`Accept ${defaults[type].toLowerCase()}`} />
            <WordingFields form={form} writable={writable} />
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Badge>Not connected</Badge>
            Available when the integration is installed. Provider keys are never entered here: they live in the server's configuration.
          </p>
        )
      }
    </SettingsCard>
  )
}

/** The order of the methods that are on, as customers see them at checkout. @param {{ value: any; }} props */
function OrderCard({ value }) {
  const save = useSavePayments()
  const toast = useToast()
  const can = useCan()
  /** @type {Method[]} */
  const on = value.methods.filter((/** @type {Method} */ m) => m.enabled).sort((/** @type {Method} */ a, /** @type {Method} */ b) => a.sortOrder - b.sortOrder)

  /** @param {number} i @param {number} to */
  function move(i, to) {
    const order = on.map((m) => m.type)
    order.splice(to, 0, /** @type {PaymentMethod} */ (order.splice(i, 1)[0]))
    save.mutate(
      (latest) => ({ ...latest, methods: latest.methods.map((/** @type {Method} */ m) => (order.includes(m.type) ? { ...m, sortOrder: order.indexOf(m.type) } : m)) }),
      { onError: (e) => toast.push({ title: messageFor(e), tone: 'danger' }) },
    )
  }

  return (
    <SectionCard id="order" title="Order at checkout" description="The methods that are on, in the order customers see them.">
      <ol className="space-y-1">
        {on.map((m, i) => (
          <li key={m.type} className="flex items-center justify-between gap-2 rounded-control border border-line px-3 py-2">
            <span>{m.label}</span>
            {can('settings:write') ? (
              <span className="flex gap-1">
                <IconButton label={`Move ${m.label} up`} icon={<ArrowUp aria-hidden className="size-4" />} disabled={i === 0 || save.isPending} onClick={() => move(i, i - 1)} />
                <IconButton label={`Move ${m.label} down`} icon={<ArrowDown aria-hidden className="size-4" />} disabled={i === on.length - 1 || save.isPending} onClick={() => move(i, i + 1)} />
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </SectionCard>
  )
}

/** `/settings/payments` (plan/07-admin/10-shipping-payments.md section 3). */
export function PaymentsPage() {
  const payments = useQuery(paymentsQuery)
  const store = useQuery(storeQuery)
  // the contract's `Doc` helper does not carry the extra `adapters` key into its type
  const doc = /** @type {{ value: PaymentSettings; version: number; adapters: { type: PaymentMethod; configured: boolean; }[]; } | undefined} */ (/** @type {unknown} */ (payments.data))
  const value = doc?.value
  const configured = (/** @type {PaymentMethod} */ type) => doc?.adapters.some((a) => a.type === type && a.configured) ?? false
  const on = (value?.methods ?? []).filter((m) => m.enabled).sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <>
      <PageHeader title="Payments" description="How customers can pay. Only cash on delivery is available at launch." />
      {payments.isPending || store.isPending ? <Spinner label="Loading payments" /> : null}
      {payments.isError || store.isError ? <ErrorState title="Payments could not be loaded" retryLabel="Try again" onRetry={() => (void payments.refetch(), void store.refetch())} /> : null}
      {value && store.isSuccess ? (
        <div className="space-y-6">
          <p role="status" className="rounded-control border border-line bg-surface-2 px-4 py-3 text-sm">
            Customers can pay with: <strong>{on.length ? on.map((m) => m.label).join(', ') : 'nothing: no method is on'}</strong>
          </p>
          <CodCard value={value} high={store.data.value.thresholds.highValueCodMinor} />
          <BankCard value={value} />
          {(/** @type {PaymentMethod[]} */ (['wallet', 'card', 'bnpl'])).filter((t) => t !== 'bnpl' || configured(t)).map((t) => (
            <OtherCard key={t} type={t} value={value} configured={configured(t)} />
          ))}
          <OrderCard value={value} />
        </div>
      ) : null}
    </>
  )
}
