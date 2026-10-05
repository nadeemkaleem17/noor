import { Button } from '@noor/ui/button'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { useToast } from '@noor/ui/toast'
import { useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { SectionCard } from '@/components/section-card'
import { applyPlan, combinations, maxVariants, newKey, planVariants, variantLabel } from '../variants'
import { OptionsEditor } from './options-editor'
import { VariantTable } from './variant-table'

/**
 * Options, and the variants they produce (plan/07-admin/03-products.md section 7). Generating adds only the missing combinations: existing variants keep their id, SKU, price and stock;
 * combinations that are gone are listed for confirmation first; a variant that appears on orders is disabled, never deleted.
 * @param {{ isNew: boolean; }} props
 */
export function OptionsVariantsSection({ isNew }) {
  const { control, getValues, setValue } = useFormContext()
  const toast = useToast()
  const [pending, setPending] = useState(/** @type {{ removed: string[]; } | null} */ (null))

  /** @param {boolean} confirmed */
  function generate(confirmed) {
    const options = getValues('options') ?? []
    const variants = getValues('variants') ?? []
    const total = combinations(options).length
    if (total > maxVariants) {
      toast.push({ title: `That would make ${total} variants; the most is ${maxVariants}.`, tone: 'danger' })
      return
    }
    const plan = planVariants(options, variants)
    if (plan.remove.length > 0 && !confirmed) {
      setPending({ removed: plan.remove.map((v) => v.sku || variantLabel(options, v.optionValueKeys)) })
      return
    }
    const result = applyPlan(options, variants, (keys) => ({ key: newKey(), sku: '', optionValueKeys: keys, stockMode: 'counted', maxPerOrder: 10, enabled: true }))
    setValue('variants', result.variants, { shouldDirty: true, shouldValidate: true })
    setPending(null)
    toast.push({ title: `${result.added} added, ${result.removed} removed${result.disabled ? `, ${result.disabled} disabled (they have orders)` : ''}` })
  }

  const preview = combinations(/** @type {any[]} */ (useWatch({ control, name: 'options' }) ?? [])).length

  return (
    <SectionCard id="variants" title="Options and variants" description="Sizes and other choices a customer makes. Each combination is a variant with its own SKU, price and stock.">
      <OptionsEditor />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => generate(false)}>
          Generate variants
        </Button>
        <p className="text-sm text-muted">{`${preview} ${preview === 1 ? 'combination' : 'combinations'} from the options above.`}</p>
      </div>
      <VariantTable isNew={isNew} />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Remove variants?"
        body={`These variants no longer match the options and will be removed: ${(pending?.removed ?? []).join(', ')}.`}
        confirmLabel="Remove them"
        onConfirm={() => generate(true)}
      />
    </SectionCard>
  )
}
