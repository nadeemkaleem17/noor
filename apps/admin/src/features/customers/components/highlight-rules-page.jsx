import { HighlightRuleInput, maxHighlightRules } from '@noor/contract'
import { Button } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { ErrorState } from '@noor/ui/error-state'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { Skeleton } from '@noor/ui/skeleton'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AppLink } from '@/components/app-link'
import { PageHeader } from '@/components/page-header'
import { messageFor } from '@/lib/errors'
import { useCan } from '@/lib/session'
import { highlightRulesQuery, useSaveHighlightRules } from '../api'
import { HighlightBadges, inkOn } from './highlight-badges'

/**
 * What staff edit for one rule: numbers as text, so a half-typed number is not thrown away.
 * @typedef {{ key: string, id?: string, kind: 'orders' | 'visits', minCount: string, maxCount: string, color: string, label: string, enabled: boolean }} Draft
 */

let counter = 0
/** @param {Partial<Draft>} [over] @returns {Draft} */
const blank = (over = {}) => ({ key: `new-${++counter}`, kind: 'orders', minCount: '1', maxCount: '', color: '#3b82f6', label: '', enabled: true, ...over })

/** @param {import('@noor/contract').HighlightRule} r @returns {Draft} */
const draftOf = (r) => ({ key: r.id, id: r.id, kind: r.kind, minCount: String(r.minCount), maxCount: r.maxCount === undefined ? '' : String(r.maxCount), color: r.color, label: r.label, enabled: r.enabled })

/** The number typed, or `undefined` when the box is empty or is not a whole number. @param {string} text */
const whole = (text) => (/^\d+$/.test(text.trim()) ? Number(text) : undefined)

/** @param {Draft} d */
const inputOf = (d) => ({
  ...(d.id ? { id: d.id } : {}),
  kind: d.kind,
  minCount: whole(d.minCount),
  ...(d.maxCount.trim() ? { maxCount: whole(d.maxCount) } : {}),
  color: d.color,
  label: d.label,
  enabled: d.enabled,
})

const messages = /** @type {Record<string, string>} */ ({
  too_small: 'The upper number must not be below the lower one.',
  invalid_format: 'Use a colour such as #3b82f6.',
  invalid_type: 'Type a whole number.',
  too_big: 'That is too long or too large.',
})

/** Why a rule cannot be saved, by field. @param {Draft} d @returns {Partial<Record<'minCount' | 'maxCount' | 'color' | 'label', string>>} */
function problems(d) {
  const parsed = HighlightRuleInput.safeParse(inputOf(d))
  if (parsed.success) return {}
  /** @type {Record<string, string>} */
  const found = {}
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? 'label')
    found[field] ??= field === 'label' ? 'Give it a name of up to 40 letters.' : (messages[issue.message] ?? messages[issue.code] ?? 'Check this value.')
  }
  return found
}

/** Two rules of one kind whose ranges overlap, named in words: the one that starts lower wins, which staff should know. @param {Draft[]} drafts */
function overlaps(drafts) {
  const live = drafts.filter((d) => d.enabled && whole(d.minCount) !== undefined)
  /** @type {string[]} */
  const notes = []
  for (const [i, a] of live.entries()) {
    for (const b of live.slice(i + 1)) {
      if (a.kind !== b.kind) continue
      const [aMin, bMin] = [Number(a.minCount), Number(b.minCount)]
      const [aMax, bMax] = [a.maxCount.trim() ? Number(a.maxCount) : Infinity, b.maxCount.trim() ? Number(b.maxCount) : Infinity]
      if (aMin <= bMax && bMin <= aMax) {
        const [first, second] = aMin <= bMin ? [a, b] : [b, a]
        notes.push(`"${first.label || 'Unnamed'}" and "${second.label || 'Unnamed'}" overlap: where both fit, "${first.label || 'Unnamed'}" is used.`)
      }
    }
  }
  return notes
}

/** `/customers/highlights`: the colours the Customers screens give by orders and by visits, all edited here (plan/17-owner-requests-2026-10.md section 6). */
export function HighlightRulesPage() {
  const can = useCan()
  const toast = useToast()
  const rules = useQuery(highlightRulesQuery)
  const save = useSaveHighlightRules()
  const writable = can('customers:write')
  // the form starts from the saved rules and is kept separately, so typing never fights a refetch
  const [drafts, setDrafts] = useState(/** @type {Draft[] | null} */ (null))
  const list = drafts ?? rules.data?.items.map(draftOf) ?? []
  const dirty = drafts !== null
  const edit = (/** @type {number} */ i, /** @type {Partial<Draft>} */ over) => setDrafts(list.map((d, n) => (n === i ? { ...d, ...over } : d)))
  const all = list.map(problems)
  const broken = all.some((p) => Object.keys(p).length > 0)
  const notes = overlaps(list)

  function submit() {
    save.mutate(/** @type {never} */ (list.map(inputOf)), {
      onSuccess: () => {
        setDrafts(null)
        toast.push({ title: 'Highlight rules saved', tone: 'success' })
      },
      onError: (e) => toast.push({ title: messageFor(e), tone: 'danger' }),
    })
  }

  return (
    <>
      <AppLink to="/customers" className="mb-2 inline-flex items-center gap-1 text-sm text-accent-text">
        <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" /> Customers
      </AppLink>
      <PageHeader
        title="Highlight rules"
        description="Colour customers by how many orders they placed, or how many times they visited. A customer gets at most one colour for orders and one for visits. Nothing here is fixed: change, switch off or delete any rule."
        actions={
          writable ? (
            <>
              {dirty ? (
                <Button variant="secondary" onClick={() => setDrafts(null)}>
                  Discard changes
                </Button>
              ) : null}
              <Button loading={save.isPending} disabled={!dirty || broken} onClick={submit}>
                Save rules
              </Button>
            </>
          ) : null
        }
      />
      {rules.isPending ? <Skeleton className="h-64 w-full" /> : null}
      {rules.isError ? <ErrorState title="The rules could not be loaded" retryLabel="Try again" onRetry={() => void rules.refetch()} /> : null}
      {rules.isSuccess ? (
        <div className="space-y-4">
          {list.length === 0 ? <p className="rounded-card border border-line bg-surface p-4 text-sm text-muted">There are no rules, so no customer is coloured. {writable ? 'Add one below.' : ''}</p> : null}
          <ul className="space-y-3">
            {list.map((d, i) => {
              const p = all[i] ?? {}
              return (
                <li key={d.key}>
                  <fieldset className="grid gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[10rem_7rem_7rem_minmax(0,1fr)_minmax(0,1fr)]" disabled={!writable}>
                    <legend className="px-1 text-sm font-medium">
                      Rule {i + 1} <HighlightBadges highlights={d.label && /^#[0-9a-f]{6}$/i.test(d.color) ? [{ ruleId: d.key, kind: d.kind, label: d.label, color: d.color }] : []} />
                    </legend>
                    <Field label="Counts">
                      <NativeSelect
                        value={d.kind}
                        onChange={(e) => edit(i, { kind: /** @type {'orders' | 'visits'} */ (e.target.value) })}
                        options={[
                          { value: 'orders', label: 'Orders placed' },
                          { value: 'visits', label: 'Website visits' },
                        ]}
                      />
                    </Field>
                    <Field label="From" error={p.minCount} required>
                      <Input type="number" inputMode="numeric" min={0} value={d.minCount} onChange={(e) => edit(i, { minCount: e.target.value })} required />
                    </Field>
                    <Field label="Up to" hint="Empty: no limit" error={p.maxCount}>
                      <Input type="number" inputMode="numeric" min={0} value={d.maxCount} onChange={(e) => edit(i, { maxCount: e.target.value })} />
                    </Field>
                    <Field label="Name shown" error={p.label} required>
                      <Input value={d.label} maxLength={40} onChange={(e) => edit(i, { label: e.target.value })} required />
                    </Field>
                    <Field label="Colour" error={p.color}>
                      <span className="flex items-center gap-2">
                        <input
                          type="color"
                          aria-label={`Colour picker for rule ${i + 1}`}
                          value={/^#[0-9a-f]{6}$/i.test(d.color) ? d.color.toLowerCase() : '#3b82f6'}
                          onChange={(e) => edit(i, { color: e.target.value })}
                          className="h-11 w-14 cursor-pointer rounded-control border border-line-strong bg-surface p-1 disabled:cursor-not-allowed"
                        />
                        <Input value={d.color} maxLength={7} onChange={(e) => edit(i, { color: e.target.value })} dir="ltr" className="font-mono" />
                      </span>
                    </Field>
                    <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-5">
                      <Checkbox label="On" checked={d.enabled} onCheckedChange={(on) => edit(i, { enabled: on === true })} />
                      <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: d.color, color: /^#[0-9a-f]{6}$/i.test(d.color) ? inkOn(d.color) : '#000000' }}>
                        {d.label || 'Preview'}
                      </span>
                      {writable ? (
                        <Button variant="secondary" size="md" iconStart={<Trash2 aria-hidden className="size-4" />} onClick={() => setDrafts(list.filter((_, n) => n !== i))}>
                          Delete rule {i + 1}
                        </Button>
                      ) : null}
                    </div>
                  </fieldset>
                </li>
              )
            })}
          </ul>
          {notes.length ? (
            <ul className="space-y-1 rounded-control bg-warning-soft px-3 py-2 text-sm text-warning" aria-label="Overlapping rules">
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          {writable ? (
            <Button variant="secondary" iconStart={<Plus aria-hidden className="size-4" />} disabled={list.length >= maxHighlightRules} onClick={() => setDrafts([...list, blank()])}>
              Add a rule
            </Button>
          ) : (
            <p className="text-sm text-muted">You can see these rules but not change them.</p>
          )}
        </div>
      ) : null}
    </>
  )
}
