import { ApiError } from '@noor/contract'
import { formatMoney } from '@noor/i18n/format'
import { Badge } from '@noor/ui/badge'
import { Button, IconButton, LinkButton } from '@noor/ui/button'
import { Card } from '@noor/ui/card'
import { Checkbox } from '@noor/ui/checkbox'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { Dialog } from '@noor/ui/dialog'
import { ErrorState } from '@noor/ui/error-state'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { Skeleton } from '@noor/ui/skeleton'
import { Textarea } from '@noor/ui/textarea'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Copy, MessageCircle, Phone } from 'lucide-react'
import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router'
import { AppLink } from '@/components/app-link'
import { HistoryPanel } from '@/components/history-panel'
import { formatDateTime, relativeTime } from '@/lib/dates'
import { messageFor } from '@/lib/errors'
import { useCan } from '@/lib/session'
import { useStepUp, wasCancelled } from '@/lib/step-up'
import { isWholePhone, telLink, waLink } from '@/lib/phone-links'
import { customerQueries, useCustomerMutations } from '../api'
import { HighlightBadges } from './highlight-badges'
import { Flags } from './customer-list'

/** @typedef {import('../api').AdminCustomer} AdminCustomer */

const money = (/** @type {{ amount: number; currency: 'PKR' }} */ m) => formatMoney(m, 'en')

/** @param {{ title: string; children: import('react').ReactNode; action?: import('react').ReactNode }} props */
function Block({ title, children, action }) {
  return (
    <Card render={<section aria-label={title} />} className="space-y-3">
      <header className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        {action}
      </header>
      {children}
    </Card>
  )
}

/** Name, email and the three flags. No COD needs a reason; the phone is the identity and cannot be changed (section 3). @param {{ customer: AdminCustomer; onClose: () => void }} props */
function EditDialog({ customer: c, onClose }) {
  const { update } = useCustomerMutations(c.id)
  const [name, setName] = useState(c.name)
  const [email, setEmail] = useState(c.email ?? '')
  const [noCod, setNoCod] = useState(c.noCod)
  const [reason, setReason] = useState(c.noCodReason ?? '')
  const [vip, setVip] = useState(c.vip)
  const [consent, setConsent] = useState(c.marketingConsent)
  const [consentNote, setConsentNote] = useState(c.consentNote ?? '')
  const valid = name.trim().length > 0 && (!noCod || reason.trim().length > 0)
  const stale = update.error instanceof ApiError && update.error.code === 'stale_write'
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Edit ${c.name}`}
      description="The phone number is the customer's identity and cannot be changed."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={update.isPending}
            disabled={!valid}
            onClick={() =>
              update.mutate(
                /** @type {never} */ ({
                  version: c.version,
                  name: name.trim(),
                  ...(email.trim() ? { email: email.trim() } : {}),
                  noCod,
                  ...(noCod ? { noCodReason: reason.trim() } : {}),
                  vip,
                  marketingConsent: consent,
                  ...(consent && consentNote.trim() ? { consentNote: consentNote.trim() } : {}),
                }),
                { onSuccess: onClose },
              )
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Name" required>
          <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Checkbox label="No cash on delivery for this phone" checked={noCod} onCheckedChange={setNoCod} />
        {noCod ? (
          <Field label="Why?" required hint="Staff see this reason, and the order shows a marker.">
            <Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
          </Field>
        ) : null}
        <Checkbox label="VIP (informational)" checked={vip} onCheckedChange={setVip} />
        <Checkbox label="Agreed to marketing messages" checked={consent} onCheckedChange={setConsent} />
        {consent ? (
          <Field label="How was consent given?">
            <Input value={consentNote} maxLength={200} onChange={(e) => setConsentNote(e.target.value)} />
          </Field>
        ) : null}
        {update.error ? (
          <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
            {stale ? 'Someone else changed this customer. Close this window to see the latest, then try again.' : messageFor(update.error)}
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}

/** Add-only notes, with who wrote them. @param {{ customer: AdminCustomer; canWrite: boolean }} props */
function Notes({ customer, canWrite }) {
  const { note } = useCustomerMutations(customer.id)
  const [text, setText] = useState('')
  return (
    <Block title="Notes">
      {customer.notes.length ? (
        <ul className="space-y-2 text-sm">
          {customer.notes.map((n) => (
            <li key={n.id} className="rounded-control bg-surface-2 p-2">
              <span className="whitespace-pre-wrap break-words">{n.body}</span>
              <span className="block text-xs text-muted">{n.staffName ?? 'Staff'} · {formatDateTime(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No notes.</p>
      )}
      {canWrite ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) note.mutate(text.trim(), { onSuccess: () => setText('') })
          }}
        >
          <Textarea aria-label="New note" rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
          {note.error ? <p role="alert" className="text-sm text-danger">{messageFor(note.error)}</p> : null}
          <Button type="submit" size="sm" variant="secondary" loading={note.isPending} disabled={!text.trim()}>
            Add note
          </Button>
        </form>
      ) : null}
    </Block>
  )
}

/** `/customers/:id` (plan/07-admin/06-customers.md section 3). The route gives the orders block (a feature does not import another). @param {{ id: string; orders?: import('react').ReactNode }} props */
export function CustomerDetail({ id, orders }) {
  const can = useCan()
  const toast = useToast()
  const navigate = useNavigate()
  const query = useQuery(customerQueries.detail(id))
  const { anonymise } = useCustomerMutations(id)
  const { run, dialog } = useStepUp()
  const [editing, setEditing] = useState(false)
  const [anonymising, setAnonymising] = useState(false)
  const c = query.data

  if (query.isPending) return <Skeleton className="h-96 w-full" />
  if (query.isError || !c) return <ErrorState title="This customer could not be loaded" retryLabel="Try again" onRetry={() => void query.refetch()} />

  const tel = telLink(c.phone)
  const wa = waLink(c.phone)
  const last4 = c.phone.replace(/\D/g, '').slice(-4)
  const gone = c.anonymisedAt !== undefined

  return (
    <>
      <header className="mb-4 space-y-2">
        <AppLink to="/customers" className="inline-flex items-center gap-1 text-sm text-accent-text">
          <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" /> Customers
        </AppLink>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="font-heading text-2xl font-semibold">{c.name}</h1>
            <p className="flex flex-wrap items-center gap-2" dir="ltr">
              <span>{c.phone}</span>
              {tel ? <LinkButton href={tel} size="md" variant="secondary" iconStart={<Phone aria-hidden className="size-4" />}>Call</LinkButton> : null}
              {wa ? <LinkButton href={wa} size="md" variant="secondary" target="_blank" iconStart={<MessageCircle aria-hidden className="size-4" />}>WhatsApp</LinkButton> : null}
              {isWholePhone(c.phone) && !gone ? (
                <IconButton size="sm" label="Copy number" icon={<Copy aria-hidden className="size-4" />} onClick={() => void navigator.clipboard?.writeText(c.phone).then(() => toast.push({ title: 'Number copied', tone: 'success' }))} />
              ) : null}
            </p>
            {c.email ? <p className="text-sm">{c.email}</p> : null}
            <p className="text-sm text-muted">
              Customer since {formatDateTime(c.createdAt)}
              {c.firstOrderAt ? ` · first order ${formatDateTime(c.firstOrderAt)}` : ' · no orders yet'}
            </p>
            <p className="flex flex-wrap items-center gap-2">
              <Flags c={c} />
              <HighlightBadges highlights={c.highlights} />
            </p>
            {gone ? <Badge tone="warning">Anonymised</Badge> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can('orders:edit') && !gone ? (
              <LinkButton href={`/orders/new?customer=${c.id}`} size="md" render={<RouterLink to={`/orders/new?customer=${c.id}`} />}>
                New order
              </LinkButton>
            ) : null}
            {can('customers:write') && !gone ? (
              <Button size="md" variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : null}
            {can('customers:anonymise') && !gone ? (
              <Button size="md" variant="danger" onClick={() => setAnonymising(true)}>
                Anonymise
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Block title="Summary">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {[
                ['Orders', String(c.ordersCount)],
                ['Delivered', String(c.deliveredCount)],
                ['Refused / returned', String(c.refusedCount)],
                ['Cancelled', String(c.cancelledCount)],
                ['Total spent', money(c.spent)],
                ['Average order', c.averageOrder ? money(c.averageOrder) : '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </Block>
          {orders}
          <Block title="Addresses">
            {c.addresses.length ? (
              <ul className="divide-y divide-line text-sm">
                {c.addresses.map((a) => (
                  <li key={`${a.address}${a.city}`} className="py-2">
                    {a.address}
                    <span className="block text-muted">
                      {a.city}
                      {a.landmark ? ` · near ${a.landmark}` : ''} · used {relativeTime(a.lastUsedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No address yet. Addresses come from orders.</p>
            )}
          </Block>
        </div>
        <div className="space-y-4">
          <Block title="Website visits">
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-muted">Visits</dt>
                <dd className="text-lg font-semibold tabular-nums">{c.visitsCount}</dd>
              </div>
              <div>
                <dt className="text-muted">Browsers</dt>
                <dd className="text-lg font-semibold tabular-nums">{c.devices}</dd>
              </div>
              <div>
                <dt className="text-muted">Last visit</dt>
                <dd className="font-semibold">{c.lastVisitAt ? relativeTime(c.lastVisitAt) : '—'}</dd>
              </div>
            </dl>
            {c.recentVisits.length ? (
              <ul className="divide-y divide-line text-sm">
                {c.recentVisits.map((v) => (
                  <li key={v.startedAt + v.landingPath} className="flex justify-between gap-3 py-1.5">
                    <span className="truncate text-muted" dir="ltr">{v.landingPath}</span>
                    <time dateTime={v.startedAt} className="shrink-0">{formatDateTime(v.startedAt)}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No visits are linked to this customer yet.</p>
            )}
            <p className="text-xs text-muted">Counted from the browsers this customer ordered from, so earlier visits count too. Orders are counted separately.</p>
          </Block>
          <Block title="Flags">
            <ul className="space-y-1 text-sm">
              <li>No cash on delivery: {c.noCod ? <strong>Yes</strong> : 'No'}{c.noCodReason ? <span className="block text-muted">{c.noCodReason}</span> : null}</li>
              <li>VIP: {c.vip ? 'Yes' : 'No'}</li>
              <li>Marketing consent: {c.marketingConsent ? 'Yes' : 'No'}{c.consentNote ? <span className="block text-muted">{c.consentNote}</span> : null}</li>
            </ul>
          </Block>
          <Notes customer={c} canWrite={can('customers:write') && !gone} />
        </div>
      </div>

      <HistoryPanel entityType="customer" entityId={c.id} />

      {editing ? <EditDialog customer={c} onClose={() => setEditing(false)} /> : null}
      <ConfirmDialog
        open={anonymising}
        onOpenChange={setAnonymising}
        title={`Anonymise ${c.name}?`}
        body={`The name, phone, email, addresses and notes of this customer, and of their finished orders, are replaced with placeholders. Totals stay for the accounts. It cannot be undone and is refused while an order is open. Type the last four digits of the phone number (${last4}) to go on.`}
        confirmLabel="Anonymise"
        confirmText={last4}
        onConfirm={async () => {
          try {
            await run(() => anonymise.mutateAsync(last4))
            toast.push({ title: 'Customer anonymised', tone: 'success' })
            void navigate('/customers')
          } catch (e) {
            if (!wasCancelled(e)) toast.push({ title: e instanceof ApiError && e.code === 'action_not_allowed' ? 'This customer has an open order, so they cannot be anonymised yet.' : messageFor(e), tone: 'danger' })
            throw e
          }
        }}
      />
      {dialog}
    </>
  )
}
