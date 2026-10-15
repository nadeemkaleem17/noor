import { StatusBadge } from '@noor/ui/badge'
import { LinkButton } from '@noor/ui/button'
import { formatDate } from '@noor/i18n/format'
import { Lock } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { DataTable } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { useCan } from '@/lib/session'
import { pageListSchema, pageQueries } from '../api'

/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').AdminPageRow>} Row */

/** @type {import('@/components/data-table').Column<Row>[]} */
const columns = [
  {
    id: 'title',
    header: 'Title',
    cell: (p) => (
      <span className="inline-flex items-center gap-2">
        {p.title}
        {p.locked ? <Lock aria-label="Required page" className="size-3.5 text-muted" /> : null}
      </span>
    ),
  },
  { id: 'slug', header: 'Address', cell: (p) => <span className="font-mono text-sm">/pages/{p.slug}</span> },
  { id: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status === 'active' ? 'active' : 'draft'} /> },
  { id: 'updatedAt', header: 'Updated', align: 'end', cell: (p) => <span className="whitespace-nowrap">{formatDate(p.updatedAt, 'en')}</span> },
  { id: 'updatedBy', header: 'Updated by', hideable: true, cell: (p) => p.updatedBy ?? '' },
]

/** @type {import('@/components/list-filters').FilterDef[]} */
const filters = [
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'active', label: 'Active' },
    ],
  },
]

/** `/content/pages` (plan/07-admin/09-content.md section 3.1). Pages the shop needs (policies, contact) carry a lock and cannot be deleted. */
export function PagesList() {
  const can = useCan()
  return (
    <>
      <PageHeader title="Pages" description="About, policies, contact and other text pages." actions={can('content:write') ? <LinkButton href="/content/pages/new" render={<RouterLink to="/content/pages/new" />}>New page</LinkButton> : null} />
      <DataTable
        id="pages"
        label="Pages"
        searchPlaceholder="Search title or address…"
        schema={pageListSchema}
        query={pageQueries.list}
        columns={columns}
        filters={filters}
        defaultSort="-updatedAt"
        rowId={(p) => p.id}
        rowLabel={(p) => p.title}
        rowHref={(p) => `/content/pages/${p.id}`}
        empty={{ title: 'No pages yet', body: can('content:write') ? 'Create the first page.' : undefined }}
      />
    </>
  )
}
