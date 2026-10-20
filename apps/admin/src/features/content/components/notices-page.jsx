import { ApiError, HomeContent, noticePalettes } from '@noor/contract'
import { Badge } from '@noor/ui/badge'
import { Button, IconButton } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { EmptyState } from '@noor/ui/empty-state'
import { ErrorState } from '@noor/ui/error-state'
import { Field, RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { Menu } from '@noor/ui/menu'
import { NativeSelect } from '@noor/ui/native-select'
import { Spinner } from '@noor/ui/spinner'
import { Table, Td, Th } from '@noor/ui/table'
import { Textarea } from '@noor/ui/textarea'
import { useToast } from '@noor/ui/toast'
import { VisuallyHidden } from '@noor/ui/visually-hidden'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { BulkBar } from '@/components/bulk-bar'
import { FormDrawer } from '@/components/form-drawer'
import { LinkInput } from '@/components/link-input'
import { PageHeader } from '@/components/page-header'
import { fromLocalInput, formatDateTime, toLocalInput } from '@/lib/dates'
import { messageFor } from '@/lib/errors'
import { contractResolver, prune } from '@/lib/form'
import { useCan } from '@/lib/session'
import { useDrawer } from '@/lib/use-drawer'
import { homeQuery, useSaveHome } from '../api'

/** @typedef {import('@noor/contract').HomeContent['notices'][number]} Notice */

const Notice = HomeContent.shape.notices.element
const MAX = 10
const newId = () => `n${Math.random().toString(36).slice(2, 10)}`

const positions = [
  { value: 'bar', label: 'A strip above the header' },
  { value: 'popup', label: 'A popup when the shop opens' },
  { value: 'side', label: 'A card at the side of the page' },
]
const positionName = /** @type {Record<string, string>} */ ({ bar: 'Strip', popup: 'Popup', side: 'Side card' })
const palettes = /** @type {Record<string, { label: string; swatch: string }>} */ ({
  accent: { label: 'Brand colour', swatch: 'bg-accent text-on-accent' },
  ink: { label: 'Dark', swatch: 'bg-fg text-bg' },
  sand: { label: 'Soft grey', swatch: 'bg-surface-2 text-fg' },
  success: { label: 'Green', swatch: 'bg-success-soft text-fg' },
  warning: { label: 'Amber', swatch: 'bg-warning-soft text-fg' },
})
const everyOptions = [
  { value: 'visit', label: 'Every visit' },
  { value: 'day', label: 'Once a day' },
  { value: 'once', label: 'Once, then never again' },
]

/** Live, waiting for its start, over, or switched off: the words staff use. @param {Notice} n @param {number} at */
export function noticeState(n, at) {
  if (n.active === false) return 'Off'
  if (n.startsAt && Date.parse(n.startsAt) > at) return 'Scheduled'
  if (n.endsAt && Date.parse(n.endsAt) <= at) return 'Ended'
  return 'Live'
}
const stateTone = /** @type {Record<string, 'success' | 'accent' | 'neutral'>} */ ({ Live: 'success', Scheduled: 'accent', Ended: 'neutral', Off: 'neutral' })

/** The notice as the shop will draw it, roughly: the colour pair, the heading, the words, the button. @param {{ value: Partial<Notice> }} props */
function Preview({ value }) {
  const pair = palettes[value.palette ?? 'accent']?.swatch ?? palettes.accent?.swatch
  const head = value.title || value.text || 'Your message'
  const more = value.body || (value.title ? value.text : '')
  if ((value.position ?? 'bar') === 'bar')
    return (
      <p className={`rounded-control px-3 py-2 text-center text-sm ${pair}`}>
        {value.text || 'Your message'}
      </p>
    )
  return (
    <div className={`space-y-1 rounded-card p-4 ${pair}`}>
      <p className="font-heading text-lg">{head}</p>
      {more ? <p className="text-sm">{more}</p> : null}
      {value.buttonText ? <span className="mt-2 inline-block rounded-control border border-current px-3 py-1 text-sm">{value.buttonText}</span> : null}
    </div>
  )
}

/** What the form holds: optional texts as empty strings, the window as instants. @param {Notice | null} n @returns {Partial<Notice>} */
const start = (n) => n ?? { id: newId(), text: '', severity: 'info', position: 'bar', palette: 'accent', popupEvery: 'day', active: true }

/**
 * The editor of one notice, in a side panel.
 * @param {{ notice: Notice | null; onSave: (n: Notice) => Promise<void>; onClose: () => void }} props
 */
function NoticeDrawer({ notice, onSave, onClose }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const form = useForm({ defaultValues: start(notice), resolver: contractResolver(Notice, (/** @type {any} */ v) => prune(v)) })
  const values = /** @type {Partial<Notice>} */ (useWatch({ control: form.control }))
  const popup = values.position === 'popup'
  const bar = (values.position ?? 'bar') === 'bar'
  return (
    <FormDrawer
      open
      title={notice ? 'Edit notice' : 'New notice'}
      onClose={onClose}
      formId="notice-form"
      saving={saving}
      error={error ? <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
      onSubmit={(e) =>
        void form.handleSubmit(async (v) => {
          setSaving(true)
          setError('')
          try {
            await onSave(/** @type {Notice} */ (/** @type {unknown} */ (prune({ ...v, active: v.active !== false }))))
          } catch (err) {
            setError(err instanceof ApiError && err.code === 'stale_write' ? 'Someone changed the home page while you were editing. Close this panel and try again.' : messageFor(err))
          } finally {
            setSaving(false)
          }
        })(e)
      }
    >
      <RHFField control={form.control} name="position" label="Where it shows">
        {(field) => <NativeSelect {...field} options={positions} />}
      </RHFField>
      <RHFField control={form.control} name="text" label={bar ? 'Message' : 'Headline'} required hint={bar ? 'One line of up to 140 letters.' : 'Used as the heading when there is no separate title below.'}>
        {(field) => <Input {...field} value={field.value ?? ''} maxLength={140} required />}
      </RHFField>
      {bar ? null : (
        <>
          <RHFField control={form.control} name="title" label="Title" hint="Optional. Replaces the headline as the heading.">
            {(field) => <Input {...field} value={field.value ?? ''} maxLength={60} />}
          </RHFField>
          <RHFField control={form.control} name="body" label="Details" hint="Up to 300 letters.">
            {(field) => <Textarea {...field} value={field.value ?? ''} rows={3} maxLength={300} />}
          </RHFField>
          <RHFField control={form.control} name="buttonText" label="Button text" hint="Needs a link.">
            {(field) => <Input {...field} value={field.value ?? ''} maxLength={24} />}
          </RHFField>
        </>
      )}
      <RHFField control={form.control} name="href" label="Link">
        {(field) => <LinkInput {...field} value={field.value ?? ''} />}
      </RHFField>
      <RHFField control={form.control} name="palette" label="Colour" hint="Pairs that are always easy to read.">
        {(field) => <NativeSelect {...field} options={noticePalettes.map((p) => ({ value: p, label: palettes[p]?.label ?? p }))} />}
      </RHFField>
      {popup ? (
        <RHFField control={form.control} name="popupEvery" label="How often one visitor sees it">
          {(field) => <NativeSelect {...field} options={everyOptions} />}
        </RHFField>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <RHFField control={form.control} name="startsAt" label="Starts" hint="Optional. Pakistan time.">
          {(field) => <Input type="datetime-local" name={field.name} ref={field.ref} onBlur={field.onBlur} value={toLocalInput(field.value)} onChange={(e) => field.onChange(fromLocalInput(e.target.value))} />}
        </RHFField>
        <RHFField control={form.control} name="endsAt" label="Ends" hint="Optional.">
          {(field) => <Input type="datetime-local" name={field.name} ref={field.ref} onBlur={field.onBlur} value={toLocalInput(field.value)} onChange={(e) => field.onChange(fromLocalInput(e.target.value))} />}
        </RHFField>
      </div>
      <Controller control={form.control} name="active" render={({ field }) => <Checkbox label="On (a notice that is off is kept but not shown)" checked={field.value !== false} onCheckedChange={field.onChange} />} />
      <Field label="Preview">
        <Preview value={values} />
      </Field>
    </FormDrawer>
  )
}

/** `/content/notices` (plan/17-owner-requests-2026-10.md item 4): every notice of the shop, where it shows, when, in which colour; add, change, switch off, reorder, delete. */
export function NoticesPage() {
  const can = useCan()
  const toast = useToast()
  const drawer = useDrawer()
  const queryClient = useQueryClient()
  const home = useQuery(homeQuery)
  const save = useSaveHome()
  const writable = can('content:write')
  const [chosen, setChosen] = useState(/** @type {string[]} */ ([]))
  const [asking, setAsking] = useState(false)
  const list = /** @type {Notice[]} */ (home.data?.value.notices ?? [])
  const [at] = useState(() => Date.now()) // when the page was opened: enough to tell live from over
  const editing = drawer.editing ? (list.find((n) => n.id === drawer.editing) ?? null) : null

  /** Saves the list of notices on top of the latest home page, so nothing else on it is touched. @param {(current: Notice[]) => Notice[]} change */
  async function apply(change) {
    const fresh = await queryClient.fetchQuery({ ...homeQuery, staleTime: 0 })
    await save.mutateAsync(/** @type {never} */ ({ value: { ...fresh.value, notices: change(/** @type {Notice[]} */ (fresh.value.notices)) }, version: fresh.version }))
  }
  /** @param {() => Promise<void>} job @param {string} done */
  const run = async (job, done) => {
    try {
      await job()
      toast.push({ title: done, tone: 'success' })
    } catch (e) {
      toast.push({ title: messageFor(e), tone: 'danger' })
      throw e
    }
  }
  /** @param {string} id @param {number} by */
  const move = (id, by) =>
    run(
      () =>
        apply((cur) => {
          const next = [...cur]
          const i = next.findIndex((n) => n.id === id)
          const [item] = next.splice(i, 1)
          if (item) next.splice(Math.max(0, Math.min(next.length, i + by)), 0, item)
          return next
        }),
      'Order saved',
    ).catch(() => {})

  return (
    <>
      <PageHeader
        title="Notices"
        description="Messages to visitors: a strip above the header, a popup when the shop opens, or a card at the side. Shown only while they are on and their dates allow."
        actions={
          writable ? (
            <Button iconStart={<Plus aria-hidden className="size-4" />} disabled={list.length >= MAX} onClick={() => drawer.create()}>
              New notice
            </Button>
          ) : null
        }
      />
      {home.isPending ? <Spinner label="Loading notices" /> : null}
      {home.isError ? <ErrorState title="Notices could not be loaded" retryLabel="Try again" onRetry={() => void home.refetch()} /> : null}
      {chosen.length ? (
        <BulkBar count={chosen.length} allMatching={false} actions={[{ id: 'delete', label: 'Delete selected', destructive: true, run: async () => ({ cancelled: true }) }]} onRun={() => setAsking(true)} onClear={() => setChosen([])} />
      ) : null}
      {home.isSuccess && list.length === 0 ? <EmptyState title="No notices yet" body="Add one to tell visitors about a sale, a delay or a holiday." /> : null}
      {list.length > 0 ? (
        <Table label="Notices">
          <caption className="sr-only">Notices</caption>
          <thead>
            <tr>
              {writable ? (
                <Th>
                  <Checkbox label={<VisuallyHidden>Select all notices</VisuallyHidden>} checked={chosen.length === list.length} onCheckedChange={(on) => setChosen(on ? list.map((n) => n.id) : [])} />
                </Th>
              ) : null}
              <Th>Notice</Th>
              <Th>Where</Th>
              <Th>Colour</Th>
              <Th>When</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {list.map((n, i) => {
              const state = noticeState(n, at)
              return (
                <tr key={n.id}>
                  {writable ? (
                    <Td>
                      <Checkbox label={<VisuallyHidden>{`Select ${n.title || n.text}`}</VisuallyHidden>} checked={chosen.includes(n.id)} onCheckedChange={() => setChosen((c) => (c.includes(n.id) ? c.filter((x) => x !== n.id) : [...c, n.id]))} />
                    </Td>
                  ) : null}
                  <Td>
                    <button type="button" className="text-start font-medium hover:underline" onClick={() => drawer.edit(n.id)}>
                      {n.title || n.text}
                    </button>
                    {n.title || n.body ? <span className="block max-w-md truncate text-xs text-muted">{n.body || n.text}</span> : null}
                  </Td>
                  <Td>
                    {positionName[n.position]}
                    {n.position === 'popup' ? <span className="block text-xs text-muted">{everyOptions.find((o) => o.value === n.popupEvery)?.label}</span> : null}
                  </Td>
                  <Td>
                    <span className={`inline-block rounded-full px-3 py-0.5 text-xs ${palettes[n.palette]?.swatch ?? ''}`}>{palettes[n.palette]?.label ?? n.palette}</span>
                  </Td>
                  <Td className="text-sm">
                    {n.startsAt || n.endsAt ? `${n.startsAt ? formatDateTime(n.startsAt) : 'Now'} to ${n.endsAt ? formatDateTime(n.endsAt) : 'no end'}` : 'Always'}
                  </Td>
                  <Td>
                    <Badge tone={stateTone[state] ?? 'neutral'}>{state}</Badge>
                  </Td>
                  <Td>
                    <Menu
                      align="end"
                      trigger={<IconButton label={`Actions for ${n.title || n.text}`} icon={<Ellipsis aria-hidden className="size-5" />} />}
                      items={[
                        { label: writable ? 'Edit' : 'View', icon: <Pencil aria-hidden className="size-4" />, onSelect: () => drawer.edit(n.id) },
                        ...(writable
                          ? [
                              { label: n.active === false ? 'Switch on' : 'Switch off', onSelect: () => void run(() => apply((cur) => cur.map((x) => (x.id === n.id ? { ...x, active: x.active === false } : x))), n.active === false ? 'Notice switched on' : 'Notice switched off').catch(() => {}) },
                              ...(i > 0 ? [{ label: 'Move up', icon: <ArrowUp aria-hidden className="size-4" />, onSelect: () => void move(n.id, -1) }] : []),
                              ...(i < list.length - 1 ? [{ label: 'Move down', icon: <ArrowDown aria-hidden className="size-4" />, onSelect: () => void move(n.id, 1) }] : []),
                              { label: 'Delete', icon: <Trash2 aria-hidden className="size-4" />, tone: /** @type {const} */ ('danger'), onSelect: () => (setChosen([n.id]), setAsking(true)) },
                            ]
                          : []),
                      ]}
                    />
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      ) : null}
      {drawer.isOpen && home.isSuccess && (drawer.creating !== null || editing) ? (
        <NoticeDrawer
          key={drawer.editing ?? 'new'}
          notice={editing}
          onClose={drawer.close}
          onSave={async (n) => {
            await apply((cur) => (cur.some((x) => x.id === n.id) ? cur.map((x) => (x.id === n.id ? n : x)) : [...cur, n]))
            toast.push({ title: 'Notice saved', tone: 'success' })
            drawer.close()
          }}
        />
      ) : null}
      <ConfirmDialog
        open={asking}
        onOpenChange={(open) => {
          setAsking(open)
          if (!open && chosen.length === 1) setChosen([])
        }}
        title={`Delete ${chosen.length} ${chosen.length === 1 ? 'notice' : 'notices'}?`}
        body={`${chosen.map((id) => list.find((n) => n.id === id)?.title || list.find((n) => n.id === id)?.text || id).slice(0, 5).join(', ')}. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          await run(() => apply((cur) => cur.filter((n) => !chosen.includes(n.id))), `${chosen.length} deleted`)
          setChosen([])
        }}
      />
    </>
  )
}
