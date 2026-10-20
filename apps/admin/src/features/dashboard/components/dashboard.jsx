import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { useCan } from '@/lib/session'
import { periodParams, presets, resolvePeriod, todayIn } from '../period'
import { KpiTiles } from './kpi-tiles'
import { RecentOrders, TopProducts, VisitsPanel, ZeroSearches } from './panels'
import { SalesChart } from './sales-chart'
import { TodoCards } from './todo-cards'

/** `/`: what needs doing now, then how the shop is doing (plan/07-admin/02-dashboard.md). The period is in the address. */
export function Dashboard() {
  const can = useCan()
  const [search, setSearch] = useSearchParams()
  const period = resolvePeriod(search)
  const today = todayIn()

  /** @param {string} id @param {{ from?: string; to?: string }} [range] */
  const choose = (id, range) =>
    setSearch((current) => {
      const next = new URLSearchParams(current)
      for (const [k, v] of Object.entries(periodParams(id, range ?? { from: period.from, to: period.to }))) {
        if (v) next.set(k, v)
        else next.delete(k)
      }
      return next
    })

  const sales = can('orders:read') // the figures of sales are for those who may read orders
  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            {sales ? (
              <>
                <Field label="Period">
                  <NativeSelect options={presets.map((p) => ({ value: p.id, label: p.label }))} value={period.id} onChange={(e) => choose(e.target.value)} />
                </Field>
                {period.id === 'custom' ? (
                  <>
                    <Field label="From">
                      <Input type="date" value={period.from} max={period.to} onChange={(e) => e.target.value && choose('custom', { from: e.target.value, to: period.to })} />
                    </Field>
                    <Field label="To">
                      <Input type="date" value={period.to} min={period.from} max={today} onChange={(e) => e.target.value && choose('custom', { from: period.from, to: e.target.value })} />
                    </Field>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        }
      />
      <div className="space-y-6">
        <TodoCards />
        {sales ? (
          <>
            <KpiTiles from={period.from} to={period.to} includesToday={period.to === today} />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <SalesChart from={period.from} to={period.to} />
              <TopProducts from={period.from} to={period.to} />
              <RecentOrders />
              <ZeroSearches from={period.from} to={period.to} />
              {can('customers:read') ? <VisitsPanel from={period.from} to={period.to} /> : null}
            </div>
          </>
        ) : (
          <ZeroSearches from={period.from} to={period.to} />
        )}
      </div>
    </>
  )
}
