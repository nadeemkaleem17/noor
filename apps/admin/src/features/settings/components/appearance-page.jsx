import { ApiError, ThemeTokens, contrast, contrastFailures, resolveColors, themeFonts } from '@noor/contract'
import { Badge } from '@noor/ui/badge'
import { Button } from '@noor/ui/button'
import { Card } from '@noor/ui/card'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { ErrorState } from '@noor/ui/error-state'
import { Field, RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { Price } from '@noor/ui/price'
import { Spinner } from '@noor/ui/spinner'
import { Switch } from '@noor/ui/switch'
import { useToast } from '@noor/ui/toast'
import { themeCss } from '@noor/ui/theme'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Controller, FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form'
import { useBlocker } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { SectionCard } from '@/components/section-card'
import { StaleWriteDialog } from '@/components/stale-write-dialog'
import { api } from '@/lib/api'
import { messageFor } from '@/lib/errors'
import { contractResolver } from '@/lib/form'
import { useCan } from '@/lib/session'
import { settingsKeys } from '../api'

const themeQuery = { queryKey: settingsKeys.theme, queryFn: (/** @type {{ signal: AbortSignal; }} */ { signal }) => api('admin.settings.getTheme', { signal }) }
const presetsQuery = { queryKey: settingsKeys.presets, queryFn: (/** @type {{ signal: AbortSignal; }} */ { signal }) => api('admin.settings.themePresets', { signal }), staleTime: 300_000 }

/** The twelve colours a person sets (the rest are derived). */
const colourKeys = /** @type {const} */ ([
  ['bg', 'Page background'],
  ['surface', 'Cards and panels'],
  ['fg', 'Text'],
  ['muted', 'Quiet text'],
  ['line', 'Lines'],
  ['accent', 'Accent (buttons)'],
  ['onAccent', 'Text on the accent'],
  ['sale', 'Sale prices'],
  ['success', 'Success'],
  ['warning', 'Warning'],
  ['danger', 'Error'],
  ['focus', 'Focus ring'],
])

/** The pairs the panel shows, with their minimum ratio and what a failure does (plan/07-admin/11-settings.md section 3). */
const pairs = /** @type {const} */ ([
  { label: 'Text on the page background', fg: 'fg', bg: 'bg', min: 4.5, blocks: true },
  { label: 'Text on cards', fg: 'fg', bg: 'surface', min: 4.5, blocks: true },
  { label: 'Quiet text on the page background', fg: 'muted', bg: 'bg', min: 4.5, blocks: true },
  { label: 'Sale price on the page background', fg: 'sale', bg: 'bg', min: 4.5, blocks: true },
  { label: 'Button text on the accent', fg: 'on-accent', bg: 'accent', min: 4.5, blocks: true },
  { label: 'Accent as text on the page background', fg: 'accent', bg: 'bg', min: 4.5, blocks: false },
  { label: 'Focus ring on the page background', fg: 'focus', bg: 'bg', min: 3, blocks: true },
])

/** The preview's CSS: the storefront's own `themeCss`, aimed at the preview box instead of the page. @param {unknown} theme */
const previewCss = (theme) => themeCss(theme).replace(':root[data-brand="storefront"]', '.theme-preview[data-brand="storefront"]')

/** A colour as a picker and a hex field that agree. @param {{ name: string; label: string; disabled: boolean; }} props */
function ColourField({ name, label, disabled }) {
  const { control } = useFormContext()
  return (
    <RHFField control={control} name={name} label={label}>
      {(field) => (
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={`${label}, picker`}
            disabled={disabled}
            value={/^#[0-9a-f]{6}$/i.test(field.value ?? '') ? field.value : '#000000'}
            className="h-10 w-12 shrink-0 rounded-control border border-line"
            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
          />
          <Input name={field.name} ref={field.ref} onBlur={field.onBlur} invalid={field.invalid} readOnly={disabled} value={field.value ?? ''} maxLength={7} className="font-mono" onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
        </div>
      )}
    </RHFField>
  )
}

/** A real piece of the shop drawn with the draft theme. @param {{ css: string; width?: number; }} props */
function Preview({ css, width }) {
  return (
    <>
      <style>{css}</style>
      <div data-brand="storefront" className="theme-preview overflow-hidden rounded-card border border-line bg-bg font-body text-fg" style={width ? { width, maxWidth: '100%' } : undefined}>
        <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
          <span className="font-heading text-lg">Rubaya</span>
          <span className="text-sm text-muted">New · Women · Sale</span>
        </div>
        <div className="space-y-3 p-4">
          <h3 className="font-heading text-xl">Embroidered Lawn 3-Piece</h3>
          <Card padding="md" className="flex gap-3">
            <div className="w-24 shrink-0 rounded-media bg-surface-2" style={{ aspectRatio: 'var(--media-ratio)' }} aria-hidden />
            <div className="space-y-1">
              <p className="font-medium">Cotton Kurta</p>
              <Price money={{ amount: 349000, currency: 'PKR' }} compareAt={{ amount: 429000, currency: 'PKR' }} />
              <div className="flex gap-1">
                <Badge tone="danger">Sale</Badge>
                <Badge tone="success">In stock</Badge>
              </div>
            </div>
          </Card>
          <div className="flex flex-wrap gap-2">
            <Button>Add to cart</Button>
            <Button variant="secondary">Wishlist</Button>
          </div>
          <Field label="Your city" hint="Where should we deliver?">
            <Input placeholder="Lahore" />
          </Field>
        </div>
      </div>
    </>
  )
}

/** Each pair of the contrast check with its ratio, and what a failure does. @param {{ colours: any; onFix: () => void; writable: boolean; }} props */
function ContrastPanel({ colours, onFix, writable }) {
  if (!colours) {
    return (
      <SectionCard id="contrast" title="Contrast check">
        <p className="text-sm text-muted">Every colour needs six hex digits, for example #C9A227, before the check can run.</p>
      </SectionCard>
    )
  }
  const t = resolveColors(colours)
  const rows = pairs.map((p) => ({ ...p, ratio: Math.round(contrast(t[p.fg] ?? '#000000', t[p.bg] ?? '#ffffff') * 100) / 100 }))
  const onAccentFails = rows.find((r) => r.fg === 'on-accent' && r.ratio < r.min)
  return (
    <SectionCard id="contrast" title="Contrast check" description="Text must be easy to read. A theme that fails a required check cannot be saved.">
      <table className="w-full text-sm">
        <caption className="sr-only">Contrast of the theme's colour pairs</caption>
        <thead>
          <tr className="text-start text-muted">
            <th className="py-1 text-start font-medium">Pair</th>
            <th className="py-1 text-end font-medium">Ratio</th>
            <th className="py-1 text-end font-medium">Needs</th>
            <th className="py-1 ps-3 text-start font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ok = r.ratio >= r.min
            return (
              <tr key={r.label} className="border-t border-line">
                <td className="py-1">{r.label}</td>
                <td className="py-1 text-end tabular-nums">{r.ratio.toFixed(2)}</td>
                <td className="py-1 text-end tabular-nums">{r.min.toFixed(1)}</td>
                <td className="py-1 ps-3">
                  {ok ? (
                    <span className="inline-flex items-center gap-1 text-success">
                      <Check aria-hidden className="size-4" /> Passes
                    </span>
                  ) : (
                    <span className={`inline-flex items-center gap-1 ${r.blocks ? 'text-danger' : 'text-warning'}`}>
                      <X aria-hidden className="size-4" /> {r.blocks ? 'Fails: blocks Save' : 'Warning'}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {onAccentFails && writable ? (
        <Button variant="secondary" onClick={onFix}>
          Fix the button text for me
        </Button>
      ) : null}
    </SectionCard>
  )
}

/** `/settings/appearance` (plan/07-admin/11-settings.md section 3). */
export function AppearancePage() {
  const theme = useQuery(themeQuery)
  const presets = useQuery(presetsQuery)
  if (theme.isPending || presets.isPending) return <Spinner label="Loading the theme" />
  if (theme.isError || presets.isError) return <ErrorState title="The theme could not be loaded" retryLabel="Try again" onRetry={() => (void theme.refetch(), void presets.refetch())} />
  return <ThemeForm key={theme.data.version} doc={theme.data} presets={presets.data.items} />
}

/** @type {Record<string, string>} */
const previewRadius = { sharp: '0px', soft: '6px', round: '9999px' }

/** One card per preset: its own colours, fonts and shape, so a choice is seen before it is made. Choosing fills the form; nothing is saved until Save.
 * @param {{ presets: { id: string; label: string; theme: any; }[]; chosenId?: string; basedOn?: { label: string }; disabled: boolean; onPick: (p: any) => void; }} props */
function PresetGallery({ presets, chosenId, basedOn, disabled, onPick }) {
  return (
    <div role="group" aria-label="Preset">
      <ul className="grid gap-3 sm:grid-cols-2">
        {presets.map((p) => {
          const t = resolveColors(p.theme.colors)
          const on = p.id === chosenId
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={on}
                disabled={disabled}
                onClick={() => onPick(p)}
                className={`block w-full rounded-card border p-2 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60 ${on ? 'border-accent ring-2 ring-accent' : 'border-line hover:border-line-strong'}`}
              >
                <span aria-hidden="true" className="block border p-3" style={{ background: t.bg, color: t.fg, borderColor: t.line, borderRadius: previewRadius[p.theme.radius.card] }}>
                  <span className="block text-lg leading-tight" style={{ fontFamily: `"${p.theme.fonts.heading}", serif` }}>Aa</span>
                  <span className="mt-1 block text-xs" style={{ fontFamily: `"${p.theme.fonts.body}", sans-serif`, color: t['fg-soft'] }}>New season</span>
                  <span className="mt-2 flex items-center gap-2">
                    <span className="px-3 py-1 text-xs" style={{ background: t.accent, color: t['on-accent'], borderRadius: previewRadius[p.theme.radius.control] }}>Add to bag</span>
                    <span className="text-xs underline" style={{ color: t['accent-text'] }}>Details</span>
                  </span>
                  <span className="mt-2 flex gap-1">
                    {['bg', 'surface-2', 'accent', 'accent-text', 'fg'].map((k) => (
                      <span key={k} className="size-4 rounded-full border" style={{ background: t[k], borderColor: t['line-strong'] }} />
                    ))}
                  </span>
                </span>
                <span className="mt-2 flex items-center justify-between gap-2 px-1 text-sm font-medium">
                  {p.label}
                  {on ? <Badge tone="success">In use</Badge> : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {chosenId ? null : <p className="mt-2 text-sm text-muted">{basedOn ? `Custom, based on ${basedOn.label}` : 'Custom'}</p>}
    </div>
  )
}

/** @param {{ doc: any; presets: { id: string; label: string; theme: any; }[]; }} props */
function ThemeForm({ doc, presets }) {
  const can = useCan()
  const toast = useToast()
  const queryClient = useQueryClient()
  const writable = can('settings:write')
  const [saving, setSaving] = useState(false)
  const [stale, setStale] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const leaving = useRef(false)
  const form = useForm({ defaultValues: doc.value, resolver: contractResolver(ThemeTokens, stripUndefined) })
  const values = /** @type {any} */ (useWatch({ control: form.control }))
  const dirty = Object.keys(form.formState.dirtyFields).length > 0
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname)

  // while a hex is half typed the theme does not parse: the preview keeps the saved theme and the check waits
  const parsed = ThemeTokens.safeParse(stripUndefined(values))
  const failures = parsed.success ? contrastFailures(parsed.data.colors) : []
  const basedOn = presets.find((p) => p.id === values.preset)
  const matches = (/** @type {{ theme: any }} */ p) => JSON.stringify({ ...p.theme, preset: undefined }) === JSON.stringify({ ...stripUndefined(values), preset: undefined })
  const chosen = presets.find(matches)

  /** @param {number} [version] */
  async function save(version = doc.version) {
    setSaving(true)
    try {
      const saved = await api('admin.settings.updateTheme', { body: /** @type {never} */ ({ value: stripUndefined(form.getValues()), version }) })
      queryClient.setQueryData(settingsKeys.theme, saved)
      toast.push({ title: 'Appearance saved', tone: 'success' })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'stale_write') setStale(true)
      else toast.push({ title: error instanceof ApiError && error.code === 'theme_contrast_failed' ? 'Some text would be hard to read. See the contrast check.' : messageFor(error), tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  /** @param {any} theme */
  const apply = (theme) => {
    form.reset(theme, { keepDefaultValues: true })
    void form.trigger()
  }

  /** Text on the accent: black or white, whichever reads better. */
  const fixOnAccent = () => {
    const accent = values.colors.accent
    form.setValue('colors.onAccent', contrast('#FFFFFF', accent) >= contrast('#000000', accent) ? '#FFFFFF' : '#000000', { shouldDirty: true, shouldValidate: true })
  }

  const css = previewCss(parsed.success ? parsed.data : doc.value)
  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={(e) => void form.handleSubmit(() => save())(e)} className="space-y-4 pb-20">
        <PageHeader
          title="Appearance"
          description="Colours, fonts and shapes of the shop. The preview uses the same code as the shop."
          actions={
            writable ? (
              <Button type="submit" loading={saving} disabled={failures.length > 0 || !parsed.success} title={failures.length > 0 ? 'Fix the contrast problems first' : undefined}>
                Save
              </Button>
            ) : null
          }
        />
        {failures.length > 0 ? (
          <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
            This theme cannot be saved: {failures.map((f) => `${f.pair.replace('/', ' on ')} is ${f.ratio}:1 (needs ${f.min}:1)`).join('; ')}.
          </p>
        ) : null}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <SectionCard id="preset" title="Starting point">
              <PresetGallery presets={presets} chosenId={chosen?.id} basedOn={basedOn} disabled={!writable} onPick={(p) => apply(p.theme)} />
              {writable && basedOn ? (
                <Button variant="secondary" onClick={() => setConfirmReset(true)}>
                  Reset to {basedOn.label}
                </Button>
              ) : null}
            </SectionCard>
            <SectionCard id="colours" title="Colours" description="Six-digit hex colours, for example #C9A227.">
              <div className="grid gap-3 sm:grid-cols-2">
                {colourKeys.map(([key, label]) => (
                  <ColourField key={key} name={`colors.${key}`} label={label} disabled={!writable} />
                ))}
              </div>
            </SectionCard>
            <SectionCard id="shape" title="Type and shape">
              <div className="grid gap-3 sm:grid-cols-2">
                <RHFField control={form.control} name="fonts.heading" label="Heading font">
                  {(field) => <NativeSelect {...field} disabled={!writable} options={themeFonts.map((f) => ({ value: f, label: f }))} />}
                </RHFField>
                <RHFField control={form.control} name="fonts.body" label="Body font">
                  {(field) => <NativeSelect {...field} disabled={!writable} options={themeFonts.map((f) => ({ value: f, label: f }))} />}
                </RHFField>
                {/** @type {const} */ ([['radius.control', 'Buttons and fields'], ['radius.card', 'Cards']]).map(([name, label]) => (
                  <RHFField key={name} control={form.control} name={name} label={label}>
                    {(field) => (
                      <NativeSelect
                        {...field}
                        disabled={!writable}
                        options={[
                          { value: 'sharp', label: 'Sharp' },
                          { value: 'soft', label: 'Soft' },
                          { value: 'round', label: 'Round' },
                        ]}
                      />
                    )}
                  </RHFField>
                ))}
                <RHFField control={form.control} name="radius.media" label="Pictures">
                  {(field) => (
                    <NativeSelect
                      {...field}
                      disabled={!writable}
                      options={[
                        { value: 'none', label: 'Square' },
                        { value: 'soft', label: 'Soft corners' },
                      ]}
                    />
                  )}
                </RHFField>
                <RHFField control={form.control} name="density" label="Spacing">
                  {(field) => (
                    <NativeSelect
                      {...field}
                      disabled={!writable}
                      options={[
                        { value: 'comfortable', label: 'Comfortable' },
                        { value: 'compact', label: 'Compact' },
                      ]}
                    />
                  )}
                </RHFField>
                <RHFField control={form.control} name="mediaRatio" label="Product picture shape">
                  {(field) => <NativeSelect {...field} disabled={!writable} options={['3/4', '2/3', '4/5', '1/1'].map((r) => ({ value: r, label: r.replace('/', ':') }))} />}
                </RHFField>
                <RHFField control={form.control} name="header.layout" label="Header layout">
                  {(field) => (
                    <NativeSelect
                      {...field}
                      disabled={!writable}
                      options={[
                        { value: 'left', label: 'Logo on the left' },
                        { value: 'center', label: 'Logo in the centre' },
                      ]}
                    />
                  )}
                </RHFField>
              </div>
              <Controller control={form.control} name="header.sticky" render={({ field }) => <Switch label="Keep the header at the top while scrolling" disabled={!writable} checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
            </SectionCard>
          </div>
          <div className="space-y-4">
            <SectionCard id="preview" title="Preview" description="On a phone and on a large screen.">
              <Preview css={css} width={360} />
              <Preview css={css} />
            </SectionCard>
            <ContrastPanel colours={parsed.success ? parsed.data.colors : null} onFix={fixOnAccent} writable={writable} />
          </div>
        </div>
      </form>
      <StaleWriteDialog
        open={stale}
        what="theme"
        onReload={() => {
          leaving.current = true
          void queryClient.invalidateQueries({ queryKey: settingsKeys.theme })
          setStale(false)
        }}
        onOverwrite={writable ? () => void queryClient.fetchQuery({ ...themeQuery, staleTime: 0 }).then((fresh) => save(fresh.version).then(() => setStale(false))) : undefined}
        saving={saving}
      />
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={`Reset to ${basedOn?.label ?? 'the preset'}?`}
        body="Your colour and shape changes are replaced by the preset's."
        confirmLabel="Reset"
        tone="accent"
        onConfirm={() => {
          if (basedOn) apply(basedOn.theme)
        }}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => !open && blocker.reset?.()}
        title="Leave without saving?"
        body="Your changes to the appearance will be lost."
        confirmLabel="Leave"
        onConfirm={() => blocker.proceed?.()}
      />
    </FormProvider>
  )
}

/** The theme without keys that are unset (an optional colour left empty). @param {any} v @returns {any} */
function stripUndefined(v) {
  if (Array.isArray(v)) return v.map(stripUndefined)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && x !== '').map(([k, x]) => [k, stripUndefined(x)]))
  return v
}
