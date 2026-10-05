import { ApiError, CityInput, CourierInput, provinces } from '@noor/contract'
import { RHFField } from '@noor/ui/field'
import { Checkbox } from '@noor/ui/checkbox'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { Switch } from '@noor/ui/switch'
import { useToast } from '@noor/ui/toast'
import { Controller, useForm } from 'react-hook-form'
import { FormDrawer } from '@/components/form-drawer'
import { messageFor } from '@/lib/errors'
import { contractResolver, prune } from '@/lib/form'
import { useCityMutations, useCourierMutations } from '../api'

/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').AdminCity>} City */
/** @typedef {import('@noor/contract').Courier} Courier */

const provinceOptions = provinces.map((p) => ({ value: p, label: p }))

/**
 * Shared by the two forms: show the server's field errors on the fields, anything else as a toast.
 * @param {import('react-hook-form').UseFormReturn<any>} form @param {ReturnType<typeof useToast>} toast @param {unknown} error
 */
function showError(form, toast, error) {
  if (error instanceof ApiError && error.issues.length > 0) for (const issue of error.issues) form.setError(issue.path, { type: issue.code, message: issue.code })
  else toast.push({ title: messageFor(error), tone: 'danger' })
}

/**
 * Add a city or change one's spelling, province or alternate spellings. A city is never deleted: it only leaves zones (plan/07-admin/10-shipping-payments.md section 2.2).
 * @param {{ open: boolean; city: City | null; onClose: () => void; }} props
 */
export function CityDrawer({ open, city, onClose }) {
  const { create, update } = useCityMutations()
  const toast = useToast()
  const toBody = (/** @type {any} */ v) => prune({ name: v.name, province: v.province, aliases: String(v.aliases ?? '').split(',').map((a) => a.trim()).filter(Boolean), isMajor: v.isMajor })
  const form = useForm({
    defaultValues: { name: city?.name ?? '', province: city?.province ?? 'Punjab', aliases: city?.aliases.join(', ') ?? '', isMajor: city?.isMajor ?? false },
    resolver: contractResolver(CityInput, toBody),
  })

  async function save() {
    try {
      const body = /** @type {never} */ (toBody(form.getValues()))
      if (city) await update.mutateAsync({ id: city.id, body })
      else await create.mutateAsync(body)
      toast.push({ title: 'City saved', tone: 'success' })
      onClose()
    } catch (error) {
      showError(form, toast, error)
    }
  }

  return (
    <FormDrawer open={open} title={city ? `Edit ${city.name}` : 'New city'} onClose={onClose} formId="city-form" saving={create.isPending || update.isPending} onSubmit={(e) => void form.handleSubmit(save)(e)}>
      <RHFField control={form.control} name="name" label="Name" required>
        {(field) => <Input {...field} maxLength={60} required />}
      </RHFField>
      <RHFField control={form.control} name="province" label="Province">
        {(field) => <NativeSelect {...field} options={provinceOptions} />}
      </RHFField>
      <RHFField control={form.control} name="aliases" label="Other spellings" hint="Separated by commas, for example Lyallpur. Customers can find the city by these.">
        {(field) => <Input {...field} />}
      </RHFField>
      <Controller control={form.control} name="isMajor" render={({ field }) => <Checkbox label="A major city (listed first at checkout)" checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
    </FormDrawer>
  )
}

/**
 * Add a courier or change one. A courier is disabled, never deleted, so old orders still name it (plan/07-admin/10-shipping-payments.md section 2.3).
 * @param {{ open: boolean; courier: Courier | null; onClose: () => void; }} props
 */
export function CourierDrawer({ open, courier, onClose }) {
  const { create, update } = useCourierMutations()
  const toast = useToast()
  const toBody = (/** @type {any} */ v) => prune({ name: v.name, trackingUrlPattern: v.trackingUrlPattern, trackingRequired: v.trackingRequired, enabled: v.enabled })
  const form = useForm({
    defaultValues: { name: courier?.name ?? '', trackingUrlPattern: courier?.trackingUrlPattern ?? '', trackingRequired: courier?.trackingRequired ?? true, enabled: courier?.enabled ?? true },
    resolver: contractResolver(CourierInput, toBody),
  })

  async function save() {
    try {
      const body = /** @type {never} */ (toBody(form.getValues()))
      if (courier) await update.mutateAsync({ id: courier.id, body })
      else await create.mutateAsync(body)
      toast.push({ title: 'Courier saved', tone: 'success' })
      onClose()
    } catch (error) {
      showError(form, toast, error)
    }
  }

  return (
    <FormDrawer open={open} title={courier ? `Edit ${courier.name}` : 'New courier'} onClose={onClose} formId="courier-form" saving={create.isPending || update.isPending} onSubmit={(e) => void form.handleSubmit(save)(e)}>
      <RHFField control={form.control} name="name" label="Name" required>
        {(field) => <Input {...field} maxLength={60} required />}
      </RHFField>
      <RHFField control={form.control} name="trackingUrlPattern" label="Tracking link" hint="Starts with https:// and contains {tracking}, where the tracking number goes. Used for the customer's Track link.">
        {(field) => <Input {...field} value={field.value ?? ''} maxLength={300} inputMode="url" dir="ltr" />}
      </RHFField>
      <Controller control={form.control} name="trackingRequired" render={({ field }) => <Checkbox label="A tracking number is needed when dispatching" checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
      <Controller control={form.control} name="enabled" render={({ field }) => <Switch label="Enabled" checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
    </FormDrawer>
  )
}
