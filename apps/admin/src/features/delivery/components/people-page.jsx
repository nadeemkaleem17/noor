import { ApiError, DeliveryPersonInput, deliveryKinds } from '@noor/contract'
import { formatMoney } from '@noor/i18n/format'
import { Badge } from '@noor/ui/badge'
import { Button, IconButton } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { EmptyState } from '@noor/ui/empty-state'
import { ErrorState } from '@noor/ui/error-state'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { Menu } from '@noor/ui/menu'
import { MoneyInput } from '@noor/ui/money-input'
import { NativeSelect } from '@noor/ui/native-select'
import { Spinner } from '@noor/ui/spinner'
import { Table, Td, Th } from '@noor/ui/table'
import { Textarea } from '@noor/ui/textarea'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { Ellipsis, Pencil, Plus, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AppLink } from '@/components/app-link'
import { FormDrawer } from '@/components/form-drawer'
import { PageHeader } from '@/components/page-header'
import { deliveryPeopleQuery } from '@/lib/delivery'
import { messageFor } from '@/lib/errors'
import { prune } from '@/lib/form'
import { useCan } from '@/lib/session'
import { useDrawer } from '@/lib/use-drawer'
import { usePersonMutations } from '../api'

/** @typedef {import('@noor/contract').DeliveryPerson} Person */

export const kindName = /** @type {Record<string, string>} */ ({ employee: 'Employee', freelancer: 'Freelancer', courier_rider: "Courier company's rider" })

/** What a person owes the shop, in words: owes, owed, or square. @param {number} amount */
export function balanceText(amount) {
  if (amount === 0) return 'Square'
  return amount > 0 ? `Owes ${formatMoney({ amount, currency: 'PKR' }, 'en')}` : `Owed ${formatMoney({ amount: -amount, currency: 'PKR' }, 'en')}`
}

/** @param {{ person: Person | null; onClose: () => void }} props */
function PersonDrawer({ person, onClose }) {
  const toast = useToast()
  const { create, update } = usePersonMutations()
  const [name, setName] = useState(person?.name ?? '')
  const [phone, setPhone] = useState(person?.phone ?? '')
  const [kind, setKind] = useState(person?.kind ?? 'freelancer')
  const [fee, setFee] = useState(/** @type {import('@noor/contract').Money | null} */ (person?.fee ?? null))
  const [active, setActive] = useState(person?.active ?? true)
  const [note, setNote] = useState(person?.note ?? '')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState(/** @type {Record<string, string>} */ ({}))
  const saving = create.isPending || update.isPending

  function submit() {
    const body = prune({ name, phone, kind, ...(fee && fee.amount > 0 ? { fee } : {}), active, note })
    const parsed = DeliveryPersonInput.safeParse(body)
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), 'Check this value.'])))
      return
    }
    setFieldErrors({})
    setError('')
    const done = {
      onSuccess: () => {
        toast.push({ title: person ? 'Person saved' : 'Person added', tone: 'success' })
        onClose()
      },
      onError: (/** @type {unknown} */ e) => setError(e instanceof ApiError && e.code === 'stale_write' ? 'Someone else changed this person. Close this panel and try again.' : e instanceof ApiError && e.issues.some((i) => i.path === 'phone') ? 'That is not a Pakistani mobile number.' : messageFor(e)),
    }
    if (person) update.mutate({ id: person.id, body: /** @type {never} */ ({ ...parsed.data, version: person.version }) }, done)
    else create.mutate(/** @type {never} */ (parsed.data), done)
  }

  return (
    <FormDrawer
      open
      title={person ? `Edit ${person.name}` : 'New delivery person'}
      onClose={onClose}
      formId="person-form"
      saving={saving}
      error={error ? <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Field label="Name" required error={fieldErrors.name}>
        <Input value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Mobile number" required error={fieldErrors.phone} hint="Written any way people write it: 0300 1234567.">
        <Input value={phone} maxLength={20} required inputMode="tel" dir="ltr" onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="Kind">
        <NativeSelect value={kind} onChange={(e) => setKind(/** @type {typeof kind} */ (e.target.value))} options={deliveryKinds.map((k) => ({ value: k, label: kindName[k] ?? k }))} />
      </Field>
      <Field label="Fee for each delivered order" hint="Credited to the person's ledger when an order is delivered. Leave empty for none.">
        <MoneyInput value={fee} onValueChange={setFee} />
      </Field>
      <Field label="Note" error={fieldErrors.note}>
        <Textarea value={note} rows={2} maxLength={300} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Checkbox label="Active (a person who is not active cannot be given new orders)" checked={active} onCheckedChange={setActive} />
    </FormDrawer>
  )
}

/** `/delivery/people` (plan/18-delivery-assignment-ledger-receipts.md section 5): who delivers, what they hold, how many orders they have out. */
export function PeoplePage() {
  const can = useCan()
  const drawer = useDrawer()
  const navigate = useNavigate()
  const people = useQuery(deliveryPeopleQuery)
  const items = people.data?.items ?? []
  const editing = drawer.editing ? (items.find((p) => p.id === drawer.editing) ?? null) : null
  const writable = can('deliveries:assign')
  const ledger = can('ledger:read')
  return (
    <>
      <PageHeader
        title="Delivery people"
        description="Riders, staff and courier riders who deliver orders. The balance is the cash they hold for the shop, less the fees they have earned."
        actions={writable ? <Button iconStart={<Plus aria-hidden className="size-4" />} onClick={() => drawer.create()}>New person</Button> : null}
      />
      {people.isPending ? <Spinner label="Loading delivery people" /> : null}
      {people.isError ? <ErrorState title="Delivery people could not be loaded" retryLabel="Try again" onRetry={() => void people.refetch()} /> : null}
      {people.isSuccess && items.length === 0 ? <EmptyState title="No delivery people yet" body="Add the first rider to start giving orders to someone." /> : null}
      {items.length ? (
        <Table label="Delivery people">
          <caption className="sr-only">Delivery people</caption>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Kind</Th>
              <Th>Phone</Th>
              <Th numeric>Orders out</Th>
              <Th numeric>Balance</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <Td>
                  {ledger ? (
                    <AppLink to={`/delivery/people/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </AppLink>
                  ) : (
                    p.name
                  )}
                </Td>
                <Td>{kindName[p.kind]}</Td>
                <Td dir="ltr">{p.phone}</Td>
                <Td numeric>{p.ordersOut}</Td>
                <Td numeric>
                  <span className={p.balance.amount > 0 ? 'font-medium text-warning' : ''}>{balanceText(p.balance.amount)}</span>
                </Td>
                <Td>{p.active ? <Badge tone="success">Active</Badge> : <Badge>Not active</Badge>}</Td>
                <Td>
                  <Menu
                    align="end"
                    trigger={<IconButton label={`Actions for ${p.name}`} icon={<Ellipsis aria-hidden className="size-5" />} />}
                    items={[
                      ...(ledger ? [{ label: 'Ledger', icon: <ScrollText aria-hidden className="size-4" />, onSelect: () => void navigate(`/delivery/people/${p.id}`) }] : []),
                      { label: writable ? 'Edit' : 'View', icon: <Pencil aria-hidden className="size-4" />, onSelect: () => drawer.edit(p.id) },
                    ]}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
      {drawer.isOpen && people.isSuccess && (drawer.creating !== null || editing) ? <PersonDrawer key={drawer.editing ?? 'new'} person={editing} onClose={drawer.close} /> : null}
    </>
  )
}
