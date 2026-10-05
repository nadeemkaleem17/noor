import { ProductInput } from '@noor/contract'
import { Button } from '@noor/ui/button'
import { useQuery } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { useFormContext, useWatch } from 'react-hook-form'
import { SectionCard } from '@/components/section-card'
import { useDebounced } from '@/lib/use-debounced'
import { productQueries } from '../api'
import { toBody } from '../form-values'

const messages = /** @type {Record<string, string>} */ ({
  basics: 'Title, handle, category and type are set',
  images: 'At least one image',
  image_alt: 'Every image has alt text',
  variant_enabled: 'At least one enabled variant',
  variant_sku_price: 'Every enabled variant has a SKU and a price',
  components: 'At least one component is listed',
  lead_time: 'The lead time is set',
  bundle_children: 'The set has at least 2 products, all active',
  compare_at: 'Compare-at prices are above the price',
  required_attributes: 'Required attributes are filled in',
})

/** The section a check's `path` belongs to. @param {string} path */
const sectionOf = (path) => {
  const head = path.split('.')[0] ?? ''
  return ({ title: 'basics', handle: 'seo', media: 'media', variants: 'variants', options: 'variants', components: 'kind', madeToOrder: 'kind', bundleProductIds: 'kind', attributes: 'attributes' })[head] ?? 'basics'
}

/** Takes the person to the field a check names. @param {string} path */
function jumpTo(path) {
  const target = document.querySelector(`[name="${path}"]`) ?? document.getElementById(sectionOf(path))
  target?.scrollIntoView({ block: 'center' })
  if (target instanceof HTMLElement) target.focus({ preventScroll: true })
}

/**
 * Whether the product could go live, live as the form changes (plan/07-admin/03-products.md section 8). The server runs the checks, so the screen and the save never disagree.
 * The form must be a valid document first; until then the card asks for the required fields.
 */
export function ChecksCard() {
  const { control } = useFormContext()
  const values = useWatch({ control })
  const body = toBody(values)
  const valid = ProductInput.safeParse(body).success
  const settled = useDebounced(valid ? JSON.stringify(body) : '', 600)
  const checks = useQuery({ ...productQueries.checks(settled), enabled: settled !== '' })
  const list = checks.data?.checks ?? []
  return (
    <SectionCard id="checks" title="Checks" description="What a product needs before it can be published.">
      {!valid ? (
        <p className="text-sm text-muted">Fill in the required fields to see the checks.</p>
      ) : (
        <ul className="space-y-2" aria-busy={checks.isFetching}>
          {list.map((c) => (
            <li key={c.code} className="flex items-start gap-2 text-sm">
              {c.ok ? <Check aria-label="Passed" className="mt-0.5 size-4 shrink-0 text-success" /> : <X aria-label="Failed" className="mt-0.5 size-4 shrink-0 text-danger" />}
              <span className="flex-1">{messages[c.code] ?? c.code}</span>
              {!c.ok && c.path ? (
                <Button variant="link" onClick={() => jumpTo(/** @type {string} */ (c.path))}>
                  Fix
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {valid && list.length > 0 ? <p className="text-sm font-medium">{list.every((c) => c.ok) ? 'Ready to publish' : 'Not ready to publish'}</p> : null}
    </SectionCard>
  )
}
