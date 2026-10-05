import { RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { useFormContext, useWatch } from 'react-hook-form'
import { SectionCard } from '@/components/section-card'
import { fromLocalInput, toLocalInput } from '@/lib/dates'
import { useCan } from '@/lib/session'

const labels = /** @type {Record<string, string>} */ ({ draft: 'Draft', scheduled: 'Scheduled', active: 'Active', archived: 'Archived' })

/** Status and, for a scheduled product, when it goes live (plan/07-admin/03-products.md section 8). Only roles with `products:publish` can leave draft. */
export function StatusCard() {
  const { control } = useFormContext()
  const can = useCan()
  const status = useWatch({ control, name: 'status' })
  const publisher = can('products:publish')
  const options = Object.keys(labels)
    .filter((s) => s === 'draft' || s === status || publisher)
    .map((s) => ({ value: s, label: labels[s] ?? s }))
  return (
    <SectionCard id="status" title="Status">
      <RHFField control={control} name="status" label="Status" hint={publisher ? undefined : 'Publishing needs a manager.'}>
        {(field) => <NativeSelect {...field} options={options} />}
      </RHFField>
      {status === 'scheduled' ? (
        <RHFField control={control} name="publishAt" label="Publish at" hint="Pakistan time. Must be in the future." required>
          {(field) => (
            <Input
              type="datetime-local"
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={toLocalInput(field.value)}
              onChange={(e) => field.onChange(fromLocalInput(e.target.value))}
              required
            />
          )}
        </RHFField>
      ) : null}
    </SectionCard>
  )
}
