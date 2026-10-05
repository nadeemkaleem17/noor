import { StoreSettings, z } from '@noor/contract'
import { Badge } from '@noor/ui/badge'
import { Button, IconButton } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { ErrorState } from '@noor/ui/error-state'
import { RHFField } from '@noor/ui/field'
import { formatMoney } from '@noor/i18n'
import { Input } from '@noor/ui/input'
import { NumberInput } from '@noor/ui/number-input'
import { Pagination } from '@noor/ui/pagination'
import { Spinner } from '@noor/ui/spinner'
import { Table, Td, Th } from '@noor/ui/table'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { SectionCard } from '@/components/section-card'
import { messageFor } from '@/lib/errors'
import { useCan } from '@/lib/session'
import { useDrawer } from '@/lib/use-drawer'
import { couriersQuery, storeQuery, useAllCities, useSaveStoreSlice, useZoneMutations, zonesQuery } from '../api'
import { CityDrawer, CourierDrawer } from './shipping-drawers'
import { SettingsCard } from './settings-card'
import { ZoneDrawer } from './zone-drawer'

/** @typedef {import('./zone-drawer').Zone} Zone */
/** @typedef {import('./zone-drawer').City} City */

const pageSize = 25
const money = (/** @type {import('@noor/contract').Money} */ m) => formatMoney(m, 'en')

/** One method line of a zone: "Standard 3–5 days Rs. 250, free over Rs. 5,000". @param {Zone['methods'][number]} m */
function methodLine(m) {
  const days = m.etaMinDays === m.etaMaxDays ? `${m.etaMinDays}` : `${m.etaMinDays}–${m.etaMaxDays}`
  return (
    <li key={m.id} className={m.enabled ? '' : 'text-muted'}>
      {m.label}: {days} {days === '1' ? 'day' : 'days'}, {money(m.fee)}
      {m.freeAbove ? `, free over ${money(m.freeAbove)}` : ''}
      {m.enabled ? '' : ' (off)'}
    </li>
  )
}

/** @param {{ zones: Zone[]; unassigned: number; onShowUnassigned: () => void; cities: City[]; }} props */
function ZonesSection({ zones, unassigned, onShowUnassigned, cities }) {
  const can = useCan()
  const toast = useToast()
  const drawer = useDrawer()
  const { remove } = useZoneMutations()
  const [deleting, setDeleting] = useState(/** @type {Zone | null} */ (null))
  const writable = can('settings:write')
  const editingId = drawer.editing?.startsWith('zone:') ? drawer.editing.slice(5) : null
  const editing = editingId ? (zones.find((z) => z.id === editingId) ?? null) : null
  const open = drawer.creating === 'zone' || editing !== null

  return (
    <SectionCard
      id="zones"
      title="Zones"
      description="A zone is a set of cities with its delivery methods. A city is in one zone only."
    >
      {writable ? (
        <div>
          <Button iconStart={<Plus aria-hidden className="size-4" />} onClick={() => drawer.create('zone')}>
            New zone
          </Button>
        </div>
      ) : null}
      {zones.length === 0 ? <p className="text-sm text-muted">No zones yet. Customers cannot order until a zone has cities and a delivery method.</p> : null}
      {zones.length > 0 ? (
        <Table label="Zones">
          <caption className="sr-only">Delivery zones</caption>
          <thead>
            <tr>
              <Th>Zone</Th>
              <Th>Cities</Th>
              <Th>Methods</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id}>
                <Td className="font-medium">{z.name}</Td>
                <Td>
                  {z.cityCount === 0 ? <span className="text-muted">None</span> : `${z.cities.slice(0, 3).map((c) => c.name).join(', ')}${z.cityCount > 3 ? ` +${z.cityCount - 3}` : ''}`}
                  <span className="block text-xs text-muted">{z.cityCount} {z.cityCount === 1 ? 'city' : 'cities'}</span>
                </Td>
                <Td>
                  <ul className="text-sm">{z.methods.map(methodLine)}</ul>
                </Td>
                <Td>
                  <div className="flex gap-1">
                    <IconButton label={`${writable ? 'Edit' : 'View'} ${z.name}`} icon={<Pencil aria-hidden className="size-4" />} onClick={() => drawer.edit(`zone:${z.id}`)} />
                    {writable ? <IconButton label={`Delete ${z.name}`} icon={<Trash2 aria-hidden className="size-4" />} onClick={() => setDeleting(z)} /> : null}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
      <p className="text-sm">
        Cities not in any zone: <strong>{unassigned}</strong>
        {unassigned > 0 ? (
          <>
            {' '}
            <Button variant="link" onClick={onShowUnassigned}>
              Show them
            </Button>
          </>
        ) : null}
      </p>
      {open ? <ZoneDrawer key={editing?.id ?? 'new'} open zone={editing} cities={cities} onClose={drawer.close} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ''}?`}
        body={deleting ? `Its ${deleting.cityCount} cities will not be deliverable until another zone takes them. Orders already placed keep the fee they were placed with.` : ''}
        confirmLabel="Delete zone"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            toast.push({ title: `${deleting.name} deleted`, tone: 'success' })
          } catch (error) {
            toast.push({ title: error instanceof Error && 'code' in error && error.code === 'no_deliverable_city' ? 'This is the last zone with cities, so it cannot be deleted.' : messageFor(error), tone: 'danger' })
            throw error
          }
        }}
      />
    </SectionCard>
  )
}

/**
 * The master list of cities, searched and paged here: it is a few hundred rows that the zone form needs anyway.
 * @param {{ cities: City[]; unassignedOnly: boolean; onUnassignedOnly: (on: boolean) => void; }} props
 */
function CitiesSection({ cities, unassignedOnly, onUnassignedOnly }) {
  const can = useCan()
  const drawer = useDrawer()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const needle = q.trim().toLowerCase()
  const matching = cities.filter((c) => (!unassignedOnly || !c.zone) && (!needle || c.name.toLowerCase().includes(needle) || c.aliases.some((a) => a.toLowerCase().includes(needle))))
  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize))
  const current = Math.min(page, pageCount)
  const rows = matching.slice((current - 1) * pageSize, current * pageSize)
  const writable = can('settings:write')
  const editingId = drawer.editing?.startsWith('city:') ? drawer.editing.slice(5) : null
  const editing = editingId ? (cities.find((c) => c.id === editingId) ?? null) : null

  return (
    <SectionCard id="cities" title="Cities" description="The cities customers can choose at checkout. A city is never deleted, only taken out of zones.">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="mb-1 block text-sm font-medium" htmlFor="city-search">
            Search cities
          </label>
          <Input id="city-search" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
        </div>
        <Checkbox label="Not in any zone" checked={unassignedOnly} onCheckedChange={(on) => (onUnassignedOnly(Boolean(on)), setPage(1))} />
        {writable ? (
          <Button iconStart={<Plus aria-hidden className="size-4" />} onClick={() => drawer.create('city')}>
            New city
          </Button>
        ) : null}
      </div>
      <Table label="Cities">
        <caption className="sr-only">Cities</caption>
        <thead>
          <tr>
            <Th>City</Th>
            <Th>Province</Th>
            <Th>Zone</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <Td>
                {c.name} {c.isMajor ? <Badge>Major</Badge> : null}
                {c.aliases.length > 0 ? <span className="block text-xs text-muted">Also: {c.aliases.join(', ')}</span> : null}
              </Td>
              <Td>{c.province}</Td>
              <Td>{c.zone ? c.zone.name : <span className="text-danger">Not in any zone</span>}</Td>
              <Td>
                <IconButton label={`${writable ? 'Edit' : 'View'} ${c.name}`} icon={<Pencil aria-hidden className="size-4" />} onClick={() => drawer.edit(`city:${c.id}`)} />
              </Td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <Td colSpan={4} className="text-muted">
                No city matches.
              </Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
      <Pagination page={current} pageCount={pageCount} onPageChange={setPage} label="Cities pages" />
      {drawer.creating === 'city' || editing ? <CityDrawer key={editing?.id ?? 'new'} open city={editing} onClose={drawer.close} /> : null}
    </SectionCard>
  )
}

function CouriersSection() {
  const can = useCan()
  const drawer = useDrawer()
  const couriers = useQuery(couriersQuery)
  const writable = can('settings:write')
  const items = couriers.data?.items ?? []
  const editingId = drawer.editing?.startsWith('courier:') ? drawer.editing.slice(8) : null
  const editing = editingId ? (items.find((c) => c.id === editingId) ?? null) : null

  return (
    <SectionCard id="couriers" title="Couriers" description="The list staff choose from when dispatching an order. A courier is switched off, never deleted.">
      {writable ? (
        <div>
          <Button iconStart={<Plus aria-hidden className="size-4" />} onClick={() => drawer.create('courier')}>
            New courier
          </Button>
        </div>
      ) : null}
      {couriers.isPending ? <Spinner label="Loading couriers" /> : null}
      {couriers.isError ? <ErrorState title="Couriers could not be loaded" retryLabel="Try again" onRetry={() => void couriers.refetch()} /> : null}
      {items.length > 0 ? (
        <Table label="Couriers">
          <caption className="sr-only">Couriers</caption>
          <thead>
            <tr>
              <Th>Courier</Th>
              <Th>Tracking number</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <Td className="font-medium">{c.name}</Td>
                <Td>{c.trackingRequired ? 'Required' : 'Optional'}</Td>
                <Td>{c.enabled ? <Badge tone="success">Enabled</Badge> : <Badge>Disabled</Badge>}</Td>
                <Td>
                  <IconButton label={`${writable ? 'Edit' : 'View'} ${c.name}`} icon={<Pencil aria-hidden className="size-4" />} onClick={() => drawer.edit(`courier:${c.id}`)} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
      {drawer.creating === 'courier' || editing ? <CourierDrawer key={editing?.id ?? 'new'} open courier={editing} onClose={drawer.close} /> : null}
    </SectionCard>
  )
}

const deliverySchema = z.strictObject({ dispatchPromise: StoreSettings.shape.dispatchPromise, thresholds: StoreSettings.shape.thresholds.pick({ lowStock: true }) })

/** The two delivery-related values that live in the store document (plan/07-admin/10-shipping-payments.md section 2.4). @param {{ doc: any; }} props */
function DeliveryCard({ doc }) {
  const save = useSaveStoreSlice()
  return (
    <SettingsCard
      id="delivery"
      title="Other delivery settings"
      defaults={{ dispatchPromise: doc.value.dispatchPromise ?? '', thresholds: { lowStock: doc.value.thresholds.lowStock } }}
      schema={deliverySchema}
      toValue={(f) => ({ dispatchPromise: f.dispatchPromise.trim() || undefined, thresholds: { lowStock: f.thresholds.lowStock } })}
      save={(slice) => save.mutateAsync((latest) => ({ ...slice, thresholds: { ...latest.thresholds, .../** @type {object} */ (slice.thresholds) } }))}
    >
      {(form, writable) => (
        <>
          <RHFField control={form.control} name="dispatchPromise" label="Dispatch promise" hint="Shown on product pages and the order page, for example: Dispatched within 1–2 working days.">
            {(field) => <Input {...field} value={field.value ?? ''} maxLength={100} readOnly={!writable} />}
          </RHFField>
          <RHFField control={form.control} name="thresholds.lowStock" label="Low-stock threshold" hint="A variant at or below this many is marked low in stock.">
            {(field) => <NumberInput name={field.name} ref={field.ref} onBlur={field.onBlur} invalid={field.invalid} min={0} max={1000} readOnly={!writable} value={field.value ?? null} onValueChange={(n) => field.onChange(n ?? 0)} />}
          </RHFField>
        </>
      )}
    </SettingsCard>
  )
}

/** `/settings/shipping` (plan/07-admin/10-shipping-payments.md section 2). */
export function ShippingPage() {
  const zones = useQuery(zonesQuery)
  const store = useQuery(storeQuery)
  const { cities, loading, error } = useAllCities()
  const [unassignedOnly, setUnassignedOnly] = useState(false)

  return (
    <>
      <PageHeader title="Shipping" description="Where you deliver, what it costs and how long it takes. The shop's city list, fees and delivery times all come from here." />
      {zones.isPending || loading ? <Spinner label="Loading shipping" /> : null}
      {zones.isError || error ? <ErrorState title="Shipping could not be loaded" retryLabel="Try again" onRetry={() => void zones.refetch()} /> : null}
      {zones.isSuccess && !loading && !error ? (
        <div className="space-y-6">
          <ZonesSection
            zones={zones.data.items}
            unassigned={zones.data.unassignedCityCount}
            cities={cities}
            onShowUnassigned={() => {
              setUnassignedOnly(true)
              document.getElementById('cities')?.scrollIntoView?.()
            }}
          />
          <CitiesSection cities={cities} unassignedOnly={unassignedOnly} onUnassignedOnly={setUnassignedOnly} />
          <CouriersSection />
          {store.isSuccess ? <DeliveryCard doc={store.data} /> : null}
        </div>
      ) : null}
    </>
  )
}
