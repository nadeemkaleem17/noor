import { Spinner } from '@noor/ui/spinner'
import { Tabs } from '@noor/ui/tabs'
import { Suspense } from 'react'
import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { FormSchemasTab } from './form-schemas-tab'
import { SizeChartsTab } from './size-charts-tab'
import { SizeSystemsTab } from './size-systems-tab'

const tabs = [
  { value: 'systems', label: 'Size systems' },
  { value: 'charts', label: 'Size charts' },
  { value: 'forms', label: 'Custom-size forms' },
]

/** `/sizes` (plan/07-admin/04-catalog.md section 5): three tabs, the current one in the address as `?tab=`. */
export function SizesPage() {
  const [search, setSearch] = useSearchParams()
  const tab = tabs.some((t) => t.value === search.get('tab')) ? /** @type {string} */ (search.get('tab')) : 'systems'
  return (
    <>
      <PageHeader title="Sizes & charts" description="The sizes products come in, the measurement tables of the size guide, and the forms made-to-order customers fill in." />
      {/* a tab change leaves any open drawer behind, so only `tab` is kept */}
      <Tabs aria-label="Sizes" items={tabs} value={tab} onValueChange={(value) => setSearch({ tab: value })} />
      <Suspense fallback={<Spinner label="Loading" />}>
        {tab === 'systems' ? <SizeSystemsTab /> : tab === 'charts' ? <SizeChartsTab /> : <FormSchemasTab />}
      </Suspense>
    </>
  )
}
