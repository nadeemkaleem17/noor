import { StoreSettings, emailEvents, emailTokens, routes } from '@noor/contract'
import { Badge } from '@noor/ui/badge'
import { Button } from '@noor/ui/button'
import { ErrorState } from '@noor/ui/error-state'
import { Field, RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { Spinner } from '@noor/ui/spinner'
import { Switch } from '@noor/ui/switch'
import { Textarea } from '@noor/ui/textarea'
import { useToast } from '@noor/ui/toast'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Controller, useWatch } from 'react-hook-form'
import { useState } from 'react'
import { DataTable } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/dates'
import { messageFor } from '@/lib/errors'
import { prune } from '@/lib/form'
import { queryOptions } from '@tanstack/react-query'
import { storeQuery, useSaveStoreSlice } from '../api'
import { SettingsCard } from './settings-card'

/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').EmailLogRow>} LogRow */

const eventInfo = /** @type {Record<string, { title: string; when: string }>} */ ({
  placed: { title: 'Order received', when: 'Right after the customer places an order.' },
  confirmed: { title: 'Order confirmed', when: 'When staff confirm the order.' },
  dispatched: { title: 'Order dispatched', when: 'When the order leaves the shop: it names the courier and the tracking number.' },
  delivered: { title: 'Order delivered', when: 'When the order is marked delivered.' },
  cancelled: { title: 'Order cancelled', when: 'When the order is cancelled.' },
  returned: { title: 'Order returned', when: 'When the parcel comes back to the shop.' },
})
const tokenHelp = /** @type {Record<string, string>} */ ({
  store: 'the shop name', name: "the customer's first name", orderNo: 'the order number', total: 'the order total', link: "the link to the customer's order page", city: 'the delivery city',
  items: 'the products ordered', eta: 'the dates it should arrive', courier: 'the courier', tracking: 'the tracking number', amountDue: 'the cash to have ready on delivery', account: 'the bank account to pay into',
})

const statusQuery = queryOptions({ queryKey: ['settings', 'emails', 'status'], queryFn: ({ signal }) => api('admin.emails.status', { signal }), staleTime: 60_000 })
const messagesStatusQuery = queryOptions({ queryKey: ['settings', 'messages', 'status'], queryFn: ({ signal }) => api('admin.messages.status', { signal }), staleTime: 60_000 })
const logSchema = routes['admin.emails.log'].query

/** @type {import('@/components/data-table').Column<LogRow>[]} */
const logColumns = [
  { id: 'createdAt', header: 'When', cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.createdAt)}</span> },
  { id: 'template', header: 'Message', cell: (r) => <span>{r.template.replace(/^order\./, '').replace(/^test\./, 'test: ').replaceAll('_', ' ')}{r.orderNumber ? <span className="block text-xs text-muted">{r.orderNumber}</span> : null}</span> },
  { id: 'recipient', header: 'To', cell: (r) => r.recipient },
  {
    id: 'status',
    header: 'Result',
    cell: (r) => (
      <span>
        <Badge tone={r.status === 'sent' ? 'success' : r.status === 'failed' ? 'danger' : 'neutral'}>{r.status === 'skipped' ? 'Not sent (no mail server)' : r.status[0]?.toUpperCase() + r.status.slice(1)}</Badge>
        {r.error ? <span className="block text-xs text-danger">{r.error}</span> : null}
      </span>
    ),
  },
]

/** One event: its switch, and, opened, its own subject and body with the words that can be taken from the order, a preview and a test message. @param {{ form: import('react-hook-form').UseFormReturn<any>; event: string; writable: boolean }} props */
function EventRow({ form, event, writable }) {
  const toast = useToast()
  const draft = /** @type {{ enabled?: boolean; subject?: string; body?: string } | undefined} */ (useWatch({ control: form.control, name: `emails.events.${event}` }))
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('')
  const [shown, setShown] = useState(/** @type {{ subject: string; body: string; sample: boolean } | null} */ (null))
  const info = eventInfo[event] ?? { title: event, when: '' }
  const preview = useMutation({ mutationFn: () => api('admin.emails.preview', { body: /** @type {never} */ ({ event, subject: draft?.subject ?? '', body: draft?.body ?? '' }) }), onSuccess: setShown })
  const test = useMutation({
    mutationFn: () => api('admin.emails.test', { body: /** @type {never} */ ({ event, to, subject: draft?.subject ?? '', body: draft?.body ?? '' }) }),
    onSuccess: (r) => toast.push({ title: r.status === 'sent' ? `A test message was sent to ${to}` : r.status === 'skipped' ? 'No mail server is set up, so nothing was sent. The test is in the log below.' : `The test could not be sent: ${r.error ?? 'the mail server refused it'}`, tone: r.status === 'sent' ? 'success' : 'warning' }),
    onError: (e) => toast.push({ title: messageFor(e), tone: 'danger' }),
  })
  const custom = Boolean(draft?.subject?.trim() || draft?.body?.trim())
  /** @param {string} token */
  const addToken = (token) => form.setValue(`emails.events.${event}.body`, `${draft?.body ?? ''}{{${token}}}`, { shouldDirty: true })

  return (
    <li className="rounded-card border border-line p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="me-auto">
          <h3 className="font-medium">{info.title}</h3>
          <p className="text-sm text-muted">{info.when}</p>
        </div>
        {custom ? <Badge tone="accent">Own wording</Badge> : null}
        <Controller control={form.control} name={`emails.events.${event}.enabled`} render={({ field }) => <Switch label={`Send "${info.title}"`} disabled={!writable} checked={field.value !== false} onCheckedChange={field.onChange} />} />
        <Button type="button" variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide the wording' : 'Edit the wording'}
        </Button>
      </div>
      {open ? (
        <div className="mt-3 space-y-3">
          <RHFField control={form.control} name={`emails.events.${event}.subject`} label="Subject" hint="Empty: the shop's own subject.">
            {(field) => <Input {...field} value={field.value ?? ''} maxLength={120} readOnly={!writable} />}
          </RHFField>
          <RHFField control={form.control} name={`emails.events.${event}.body`} label="Message" hint="Empty: the shop's own wording. Add words from the order with the buttons below.">
            {(field) => <Textarea {...field} value={field.value ?? ''} rows={6} maxLength={1500} readOnly={!writable} />}
          </RHFField>
          {writable ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Words from the order">
              {emailTokens.map((token) => (
                <button key={token} type="button" title={tokenHelp[token]} onClick={() => addToken(token)} className="rounded-full border border-line px-2.5 py-0.5 text-xs hover:bg-surface-2">
                  {`{{${token}}}`}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            <Button type="button" variant="secondary" loading={preview.isPending} onClick={() => preview.mutate()}>
              Preview
            </Button>
            {writable ? (
              <>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Send a test to
                  <Input type="email" value={to} placeholder="you@example.com" onChange={(e) => setTo(e.target.value)} />
                </label>
                <Button type="button" variant="secondary" loading={test.isPending} disabled={!to.includes('@')} onClick={() => test.mutate()}>
                  Send the test
                </Button>
                {custom ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      form.setValue(`emails.events.${event}.subject`, '', { shouldDirty: true })
                      form.setValue(`emails.events.${event}.body`, '', { shouldDirty: true })
                      setShown(null)
                    }}
                  >
                    Use the shop's wording
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
          {shown ? (
            <div role="region" aria-label="Preview" className="space-y-1 rounded-control bg-surface-2 p-3 text-sm">
              <p className="font-medium">{shown.subject}</p>
              <p className="whitespace-pre-wrap">{shown.body}</p>
              {shown.sample ? <p className="text-xs text-muted">Filled with made-up values: the shop has no order yet.</p> : <p className="text-xs text-muted">Filled from the newest order.</p>}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

/** @param {{ doc: any }} props */
function SendingCard({ doc }) {
  const save = useSaveStoreSlice()
  const e = doc.value.emails
  const status = useQuery(statusQuery)
  return (
    <SettingsCard
      id="emails"
      title="Emails"
      description="What customers are emailed about their order. Customers who gave no email address get only the WhatsApp text, which staff copy from the order."
      errorPath={(path) => path}
      defaults={{ emails: { enabled: e.enabled, senderName: e.senderName ?? '', replyTo: e.replyTo ?? '', events: Object.fromEntries(emailEvents.map((k) => [k, { enabled: e.events[k].enabled, subject: e.events[k].subject ?? '', body: e.events[k].body ?? '' }])) } }}
      schema={StoreSettings.pick({ emails: true })}
      toValue={(f) => ({ emails: prune(f.emails) })}
      save={(slice) => save.mutateAsync(slice)}
    >
      {(form, writable) => (
        <>
          <Controller control={form.control} name="emails.enabled" render={({ field }) => <Switch label="Send emails to customers" disabled={!writable} checked={field.value !== false} onCheckedChange={field.onChange} />} />
          <div className="grid gap-3 sm:grid-cols-2">
            <RHFField control={form.control} name="emails.senderName" label="Sender name" hint="The name the customer sees. Empty: the server's own.">
              {(field) => <Input {...field} value={field.value ?? ''} maxLength={60} readOnly={!writable} />}
            </RHFField>
            <RHFField control={form.control} name="emails.replyTo" label="Replies go to" hint="Empty: replies go to the sending address.">
              {(field) => <Input {...field} value={field.value ?? ''} type="email" maxLength={254} readOnly={!writable} />}
            </RHFField>
          </div>
          {status.data ? (
            <p className="text-sm text-muted">
              Sent from <span className="font-mono">{status.data.from}</span>. The address is set on the server, because the mail service vouches for it; only the name can be changed here.
            </p>
          ) : null}
          <ul className="space-y-3">
            {emailEvents.map((event) => (
              <EventRow key={event} form={form} event={event} writable={writable} />
            ))}
          </ul>
        </>
      )}
    </SettingsCard>
  )
}

/**
 * The customer's order message to their phone (SMS or WhatsApp) through the gateway the server has: one switch, and a test message to a number staff type. The gateway's address and key are the
 * server's settings, never kept here.
 * @param {{ doc: any }} props
 */
function PhoneMessagesCard({ doc }) {
  const save = useSaveStoreSlice()
  const toast = useToast()
  const status = useQuery(messagesStatusQuery)
  const [to, setTo] = useState('')
  const test = useMutation({
    mutationFn: () => api('admin.messages.test', { body: { to } }),
    onSuccess: (r) =>
      toast.push({
        title: r.status === 'sent' ? `A test message was sent to ${to}` : r.status === 'skipped' ? 'No gateway is set up on this server, so nothing was sent.' : `The gateway did not take it: ${r.error ?? 'unknown error'}`,
        tone: r.status === 'sent' ? 'success' : 'danger',
      }),
    onError: (e) => toast.push({ title: messageFor(e), tone: 'danger' }),
  })
  return (
    <div className="mt-4">
      <SettingsCard
        id="phone-messages"
        title="Phone messages"
        description="The same order messages, sent as SMS or WhatsApp to the number the customer gave. Without this, each one is only written down on the order for staff to copy into WhatsApp."
        defaults={{ messages: { enabled: doc.value.messages?.enabled === true } }}
        schema={StoreSettings.pick({ messages: true })}
        toValue={(f) => ({ messages: { enabled: f.messages.enabled === true } })}
        save={(slice) => save.mutateAsync(slice)}
      >
        {(form, writable) => (
          <>
            <Controller control={form.control} name="messages.enabled" render={({ field }) => <Switch label="Send order messages to customers' phones" disabled={!writable} checked={field.value === true} onCheckedChange={field.onChange} />} />
            {status.data ? (
              <p className={`rounded-control px-3 py-2 text-sm ${status.data.configured ? 'bg-success-soft' : 'bg-warning-soft'}`} role="status">
                {status.data.configured
                  ? 'This server has a gateway, so messages can leave it once the switch is on.'
                  : 'This server has no gateway, so nothing can leave it even with the switch on. Setting one up is a change to the server settings (MESSAGE_GATEWAY_URL and MESSAGE_GATEWAY_KEY), made by whoever runs the server.'}
              </p>
            ) : null}
            {writable ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-56 flex-1">
                  <Field label="Send a test message to" hint="A mobile number, such as 0300 1234567. It goes whether or not the switch is on.">
                    <Input value={to} type="tel" inputMode="tel" maxLength={40} onChange={(e) => setTo(e.target.value)} />
                  </Field>
                </div>
                <Button type="button" variant="secondary" loading={test.isPending} disabled={to.trim().length < 5} onClick={() => test.mutate()}>
                  Send a test message
                </Button>
              </div>
            ) : null}
          </>
        )}
      </SettingsCard>
    </div>
  )
}

/** `/settings/emails` (plan/17-owner-requests-2026-10.md item 13): which order emails go out, in whose name and in which words, with a preview, a test message and the log of what happened. */
export function EmailsPage() {
  const store = useQuery(storeQuery)
  const status = useQuery(statusQuery)
  return (
    <>
      <PageHeader title="Emails" description="The emails customers get as their order moves along, and the record of every one." />
      {status.data && !status.data.configured ? (
        <p role="status" className="mb-4 rounded-control bg-warning-soft px-3 py-2 text-sm">
          No mail server is set up on this server, so nothing is being emailed: each message is only written to the log below as "Not sent". Setting one up is a change to the server's settings (MAIL_URL); your developer does it once.
        </p>
      ) : null}
      {store.isPending ? <Spinner label="Loading the email settings" /> : null}
      {store.isError ? <ErrorState title="The email settings could not be loaded" retryLabel="Try again" onRetry={() => void store.refetch()} /> : null}
      {store.isSuccess ? <SendingCard doc={store.data} /> : null}
      {store.isSuccess ? <PhoneMessagesCard doc={store.data} /> : null}
      <h2 className="mb-2 mt-8 font-heading text-lg font-semibold">What was sent</h2>
      <DataTable
        id="email-log"
        label="Email log"
        schema={logSchema}
        query={(params) => queryOptions({ queryKey: ['settings', 'emails', 'log', params], queryFn: ({ signal }) => api('admin.emails.log', { query: /** @type {never} */ (params), signal }) })}
        columns={logColumns}
        filters={[{ key: 'status', label: 'Result', type: 'select', options: [{ value: 'sent', label: 'Sent' }, { value: 'failed', label: 'Failed' }, { value: 'skipped', label: 'Not sent' }] }]}
        defaultSort="-createdAt"
        rowId={(r) => r.id}
        rowLabel={(r) => `${r.template} to ${r.recipient}`}
        empty={{ title: 'No emails yet', body: 'Each email appears here when an order moves along, or when you send a test.' }}
      />
    </>
  )
}
