import { Button, IconButton } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { EmptyState } from '@noor/ui/empty-state'
import { ErrorState } from '@noor/ui/error-state'
import { Menu } from '@noor/ui/menu'
import { NativeSelect } from '@noor/ui/native-select'
import { Pagination } from '@noor/ui/pagination'
import { Popover } from '@noor/ui/popover'
import { Skeleton } from '@noor/ui/skeleton'
import { Table, Td, Th } from '@noor/ui/table'
import { useToast } from '@noor/ui/toast'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Ellipsis } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { downloadBlob } from '@/lib/download'
import { messageFor } from '@/lib/errors'
import { useListParams } from '@/lib/list-params'
import { setHiddenColumns, usePrefs } from '@/lib/prefs'
import { useCan } from '@/lib/session'
import { AppLink } from './app-link'
import { BulkBar, FailuresDialog, failureReason, JobWatcher } from './bulk-bar'
import { chipText, FilterChips, FilterControls, filterKeys, SearchBox } from './list-filters'

/**
 * @template T
 * @typedef {object} Column
 * @property {string} id - also the `sort` value when the column is sortable
 * @property {string} header
 * @property {(row: T) => import('react').ReactNode} cell
 * @property {boolean} [sortable]
 * @property {'start' | 'end'} [align] - `end` for numbers, money and dates
 * @property {boolean} [hideable]
 * @property {boolean} [defaultHidden]
 */

/** @param {number} n */
const fmt = (n) => n.toLocaleString('en')

/**
 * The one list component of the admin (plan/07-admin/14-tables-bulk.md). Search, filters, sort, page and page size live in the address;
 * the server sorts, filters and pages. Declare columns, filters and actions; do not build a `<table>` by hand.
 * Not built yet: card layout on small screens (`cardBelow`, with Orders), column resizing, virtualised rows (100 plain rows need none), the `async` filter.
 *
 * @template T
 * @param {object} props
 * @param {string} props.id - names the table in saved preferences
 * @param {string} props.label - what the table lists ("Products"); its caption and the base of the search placeholder
 * @param {import('@noor/contract').z.ZodType} props.schema - parses the address into list params (the route's query schema)
 * @param {(params: any) => import('@tanstack/react-query').UseQueryOptions<{ items: T[]; total: number; page: number; size: number; }, Error, { items: T[]; total: number; page: number; size: number; }, any>} props.query
 * @param {Column<T>[]} props.columns - define at module scope
 * @param {import('./list-filters').FilterDef[]} [props.filters]
 * @param {string} props.defaultSort - `-updatedAt` for descending
 * @param {(row: T) => string} props.rowId
 * @param {(row: T) => string} props.rowLabel - names the row for assistive technology and failure lists
 * @param {(row: T) => string} [props.rowHref] - makes the first cell a real link and the row clickable
 * @param {import('./bulk-bar').BulkAction[]} [props.bulkActions] - leave out for no selection column
 * @param {(id: string) => Promise<import('./bulk-bar').JobStatus>} [props.getJob] - needed when an action can answer with a background job
 * @param {(row: T) => import('@noor/ui/menu').MenuItem[]} [props.rowActions]
 * @param {{ title: string; body?: string; action?: import('react').ReactNode; }} props.empty - shown when the list is empty and unfiltered
 * @param {string} [props.searchPlaceholder]
 */
export function DataTable({ id, label, schema, query, columns, filters = [], defaultSort, rowId, rowLabel, rowHref, bulkActions = [], getJob, rowActions, empty, searchPlaceholder }) {
  const { params, set } = useListParams(schema)
  const result = useQuery({ ...query(params), placeholderData: keepPreviousData })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const can = useCan()
  const prefs = usePrefs()

  const actions = bulkActions.filter((a) => !a.permission || can(a.permission))
  const hidden = prefs.tables[id]?.hidden ?? columns.filter((c) => c.defaultHidden).map((c) => c.id)
  const shown = columns.filter((c) => !hidden.includes(c.id))
  const sort = /** @type {string} */ (params.sort ?? defaultSort)

  // ---- selection: kept across pages, dropped when the search or a filter changes
  const matching = Object.fromEntries(Object.entries(/** @type {Record<string, unknown>} */ (params)).filter(([k]) => !['page', 'size', 'sort'].includes(k)))
  const matchKey = JSON.stringify(matching)
  const [selection, setSelection] = useState({ key: matchKey, ids: /** @type {string[]} */ ([]), all: false })
  const current = selection.key === matchKey ? selection : { key: matchKey, ids: [], all: false }
  const lastClicked = useRef(/** @type {number | null} */ (null))
  const rows = result.data?.items ?? []
  const total = result.data?.total ?? 0
  const pageIds = rows.map(rowId)
  const pageAllSelected = pageIds.length > 0 && pageIds.every((i) => current.ids.includes(i))
  const selectedCount = current.all ? total : current.ids.length

  /** @param {string[]} ids @param {boolean} on */
  const toggle = (ids, on) => setSelection({ key: matchKey, all: false, ids: on ? [...new Set([...current.ids, ...ids])] : current.ids.filter((i) => !ids.includes(i)) })

  // ---- bulk actions: one request for the whole selection
  const [confirming, setConfirming] = useState(/** @type {import('./bulk-bar').BulkAction | null} */ (null))
  const [failures, setFailures] = useState(/** @type {{ label: string; href?: string; reason: string; }[] | null} */ (null))
  const [jobs, setJobs] = useState(/** @type {{ jobId: string; action: import('./bulk-bar').BulkAction; }[]} */ ([]))

  /** @param {import('./bulk-bar').BulkResult} r @param {import('./bulk-bar').BulkAction} action */
  function report(r, action) {
    const list = r.failed.map((f) => {
      const row = rows.find((x) => rowId(x) === f.id)
      return { label: row ? rowLabel(row) : f.id, href: row && rowHref ? rowHref(row) : undefined, reason: failureReason(f) }
    })
    const ok = r.succeeded.length
    if (r.failed.length === 0) toast.push({ title: (action.done ?? ((n) => `${fmt(n)} done`))(ok), tone: 'success' })
    else if (ok === 0) setFailures(list)
    else toast.push({ title: `${fmt(ok)} done, ${fmt(r.failed.length)} failed`, tone: 'warning', action: { label: 'View failures', onClick: () => setFailures(list) } })
    // succeeded rows leave the selection; failed ones stay selected
    setSelection({ key: matchKey, all: false, ids: r.failed.map((f) => f.id) })
    void queryClient.invalidateQueries({ queryKey: [query(params).queryKey?.[0]] })
  }

  /** @param {import('./bulk-bar').BulkAction} action */
  async function run(action) {
    const count = selectedCount
    const target = current.all ? { filter: /** @type {Record<string, unknown>} */ (matching), expectedTotal: total } : { ids: current.ids }
    try {
      const outcome = await action.run(target)
      if ('jobId' in outcome) {
        toast.push({ title: `Working on ${fmt(count)} items…` })
        setJobs((j) => [...j, { jobId: outcome.jobId, action }])
      } else if ('download' in outcome) downloadBlob(outcome.download.filename, outcome.download.blob)
      else report(outcome, action)
    } catch (error) {
      toast.push({ title: messageFor(error), tone: 'danger' }) // the request itself failed: nothing was done, the selection stays
      throw error
    }
  }

  /** @param {import('./bulk-bar').BulkAction} action */
  const start = (action) => (action.destructive || selectedCount > 50 ? setConfirming(action) : void run(action).catch(() => {}))

  // ---- rendering
  const filtered = Boolean(params.q) || filters.some((f) => chipText(f, params))
  const first = rows.length ? (params.page - 1) * params.size + 1 : 0
  const range = `${fmt(first)}–${fmt(first + Math.max(rows.length - 1, 0))} of ${fmt(total)}`
  const refreshing = result.isFetching && !result.isPending
  const colSpan = shown.length + (actions.length ? 1 : 0) + (rowActions ? 1 : 0)

  /** @param {Column<T>} c */
  function nextSort(c) {
    const raw = /** @type {string | undefined} */ (params.sort)
    return raw === c.id ? `-${c.id}` : raw === `-${c.id}` ? undefined : c.id
  }

  return (
    <section aria-label={label} className="space-y-3">
      {selectedCount > 0 && actions.length ? (
        <BulkBar count={selectedCount} allMatching={current.all} actions={actions} onRun={start} onClear={() => setSelection({ key: matchKey, ids: [], all: false })} />
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox value={params.q} placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}…`} onSearch={(q) => set({ q }, { replace: true })} />
            <FilterControls filters={filters} params={params} onChange={(patch) => set(patch)} />
            {columns.some((c) => c.hideable) ? (
              <span className="ms-auto">
                <Popover label="Columns" align="end" trigger={<IconButton label="Columns" icon={<Columns3 aria-hidden className="size-5" />} />}>
                  <div className="space-y-2">
                    {columns.filter((c) => c.hideable).map((c) => (
                      <Checkbox key={c.id} label={c.header} checked={!hidden.includes(c.id)} onCheckedChange={(on) => setHiddenColumns(id, on ? hidden.filter((h) => h !== c.id) : [...hidden, c.id])} />
                    ))}
                  </div>
                </Popover>
              </span>
            ) : null}
          </div>
          <FilterChips filters={filters} params={params} onChange={(patch) => set(patch)} />
        </div>
      )}

      <p role="status" className="sr-only">
        {result.isSuccess ? `${label}: ${range}` : ''}
      </p>

      {result.isError && !result.data ? (
        <ErrorState title={`${label} could not be loaded`} retryLabel="Try again" onRetry={() => void result.refetch()} />
      ) : (
        <div aria-busy={refreshing} className={refreshing ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <Table label={label}>
            <caption className="sr-only">{label}</caption>
            <thead>
              <tr>
                {actions.length ? (
                  <Th className="w-10">
                    <Checkbox label={<span className="sr-only">Select this page</span>} checked={pageAllSelected} onCheckedChange={(on) => toggle(pageIds, on)} />
                  </Th>
                ) : null}
                {shown.map((c) => {
                  const dir = sort === c.id ? 'ascending' : sort === `-${c.id}` ? 'descending' : 'none'
                  return (
                    <Th key={c.id} numeric={c.align === 'end'} aria-sort={c.sortable ? dir : undefined}>
                      {c.sortable ? (
                        <button type="button" className="inline-flex items-center gap-1 font-medium hover:text-fg" onClick={() => set({ sort: nextSort(c) })}>
                          {c.header}
                          {dir === 'ascending' ? <ArrowUp aria-hidden className="size-3.5" /> : dir === 'descending' ? <ArrowDown aria-hidden className="size-3.5" /> : <ArrowUpDown aria-hidden className="size-3.5 opacity-40" />}
                        </button>
                      ) : (
                        c.header
                      )}
                    </Th>
                  )
                })}
                {rowActions ? <Th className="w-10"><span className="sr-only">Actions</span></Th> : null}
              </tr>
            </thead>
            <tbody>
              {result.isPending
                ? Array.from({ length: 10 }, (_, i) => (
                    <tr key={i}>
                      <Td colSpan={colSpan}>
                        <Skeleton className="h-6 w-full" />
                      </Td>
                    </tr>
                  ))
                : rows.length === 0
                  ? (
                    <tr>
                      <Td colSpan={colSpan}>
                        {filtered ? (
                          <EmptyState title="No results" body="Nothing matches the search and filters." action={<Button variant="secondary" onClick={() => set({ q: undefined, ...Object.fromEntries(filters.flatMap(filterKeys).map((k) => [k, undefined])) })}>Clear filters</Button>} />
                        ) : (
                          <EmptyState title={empty.title} body={empty.body} action={empty.action} />
                        )}
                      </Td>
                    </tr>
                  )
                  : rows.map((row, index) => {
                      const key = rowId(row)
                      const href = rowHref?.(row)
                      return (
                        <tr
                          key={key}
                          aria-selected={actions.length ? current.ids.includes(key) || current.all : undefined}
                          className={href ? 'cursor-pointer' : undefined}
                          onClick={(e) => {
                            if (href && !(/** @type {HTMLElement} */ (e.target).closest('a,button,input,label,[role=checkbox],[role=menuitem]'))) void navigate(href)
                          }}
                        >
                          {actions.length ? (
                            <Td>
                              <Checkbox
                                label={<span className="sr-only">{`Select ${rowLabel(row)}`}</span>}
                                checked={current.all || current.ids.includes(key)}
                                onCheckedChange={(on, details) => {
                                  const shift = /** @type {MouseEvent | undefined} */ (details?.event)?.shiftKey
                                  const last = lastClicked.current
                                  lastClicked.current = index
                                  if (shift && last !== null) toggle(pageIds.slice(Math.min(last, index), Math.max(last, index) + 1), on)
                                  else toggle([key], on)
                                }}
                              />
                            </Td>
                          ) : null}
                          {shown.map((c, i) => (
                            <Td key={c.id} numeric={c.align === 'end'}>
                              {i === 0 && href ? <AppLink to={href} className="font-medium text-fg underline-offset-2 hover:underline">{c.cell(row)}</AppLink> : c.cell(row)}
                            </Td>
                          ))}
                          {rowActions ? (
                            <Td>
                              <Menu align="end" trigger={<IconButton label={`Actions for ${rowLabel(row)}`} icon={<Ellipsis aria-hidden className="size-5" />} />} items={rowActions(row)} />
                            </Td>
                          ) : null}
                        </tr>
                      )
                    })}
            </tbody>
          </Table>
        </div>
      )}

      {actions.length && pageAllSelected && !current.all && total > rows.length ? (
        <p className="text-sm">
          All {fmt(rows.length)} on this page are selected.{' '}
          <Button variant="link" onClick={() => setSelection({ key: matchKey, ids: [], all: true })}>
            Select all {fmt(total)} matching this filter
          </Button>
        </p>
      ) : null}

      {result.isSuccess && total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <p>{range}</p>
          <Pagination label={`${label} pages`} page={params.page} pageCount={Math.max(1, Math.ceil(total / params.size))} onPageChange={(page) => set({ page })} />
          <label className="inline-flex items-center gap-2">
            Rows per page
            <NativeSelect
              aria-label="Rows per page"
              options={['25', '50', '100'].map((v) => ({ value: v, label: v }))}
              value={String(params.size)}
              onChange={(e) => set({ size: Number(e.target.value) })}
              className="w-auto"
            />
          </label>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`${confirming?.label ?? ''} ${fmt(selectedCount)} ${selectedCount === 1 ? 'item' : 'items'}?`}
        body={confirming?.destructive ? 'This cannot be undone.' : 'This changes every selected item.'}
        confirmLabel={confirming?.label ?? 'Confirm'}
        tone={confirming?.destructive ? 'danger' : 'accent'}
        confirmText={confirming?.destructive && selectedCount > 20 ? String(selectedCount) : undefined}
        onConfirm={async () => {
          if (confirming) await run(confirming)
        }}
      />
      <FailuresDialog failures={failures} onClose={() => setFailures(null)} />
      {getJob
        ? jobs.map((j) => (
            <JobWatcher
              key={j.jobId}
              jobId={j.jobId}
              getJob={getJob}
              onEnd={(status) => {
                setJobs((all) => all.filter((x) => x.jobId !== j.jobId))
                if (status.state === 'failed') toast.push({ title: status.error ?? `${j.action.label} failed`, tone: 'danger' })
                else if (status.result && 'exportId' in status.result) toast.push({ title: 'Export ready: find it in Settings, Data', tone: 'success' })
                else if (status.result) report(status.result, j.action)
              }}
            />
          ))
        : null}
    </section>
  )
}
