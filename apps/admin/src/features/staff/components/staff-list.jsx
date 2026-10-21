import { Badge } from '@noor/ui/badge'
import { Button, LinkButton } from '@noor/ui/button'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router'
import { DataTable } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { formatDateTime, relativeTime } from '@/lib/dates'
import { useCan } from '@/lib/session'
import { useShortcut } from '@/lib/shortcuts'
import { rolesQuery, staffListSchema, staffQueries } from '../api'
import { PermissionsButton } from './permissions-dialog'
import { useStaffActions } from './staff-actions'

/** @typedef {import('@noor/contract').StaffUser} Staff */

export const humanise = (/** @type {string} */ v) => v.replace(/^./, (c) => c.toUpperCase())

/** "On", or "Off" in red when the person's role needs it. @param {{ staff: Staff; }} props */
export function TwoFactorBadge({ staff }) {
  const roles = useQuery(rolesQuery)
  if (staff.twoFactorEnabled) return <Badge tone="success">On</Badge>
  const required = roles.data?.items.find((r) => r.role === staff.role)?.twoFactorRequired
  return <Badge tone={required ? 'danger' : 'neutral'}>Off</Badge>
}

/** @param {{ staff: Staff; }} props */
export function StatusCell({ staff }) {
  if (staff.status === 'invited') {
    return (
      <span>
        Invited
        {staff.inviteExpiresAt ? <span className="block text-xs text-muted">expires {relativeTime(staff.inviteExpiresAt)}</span> : null}
      </span>
    )
  }
  if (staff.status === 'deactivated') return <Badge>Deactivated</Badge>
  return <Badge tone="success">Active</Badge>
}

/** @type {import('@/components/data-table').Column<Staff>[]} */
const columns = [
  {
    id: 'name',
    header: 'Name',
    sortable: true,
    cell: (s) => (
      <span>
        {s.name}
        <span className="block text-xs text-muted">{s.email}</span>
      </span>
    ),
  },
  { id: 'role', header: 'Role', cell: (s) => <span>{humanise(s.role)}{s.profileId ? <Badge tone="accent" className="ms-2">Custom role</Badge> : s.grants.length + s.revokes.length > 0 ? <Badge tone="accent" className="ms-2">Custom access</Badge> : null}</span> },
  { id: 'twoFactor', header: 'Two-step', cell: (s) => <TwoFactorBadge staff={s} /> },
  { id: 'status', header: 'Status', cell: (s) => <StatusCell staff={s} /> },
  {
    id: 'lastSeenAt',
    header: 'Last active',
    sortable: true,
    align: 'end',
    cell: (s) => (s.lastSeenAt ? <span title={formatDateTime(s.lastSeenAt)}>{relativeTime(s.lastSeenAt)}</span> : <span className="text-muted">Never</span>),
  },
]

/** @type {import('@/components/list-filters').FilterDef[]} */
const filters = [
  { key: 'role', label: 'Role', type: 'select', options: ['owner', 'manager', 'catalog', 'fulfilment', 'support', 'viewer'].map((v) => ({ value: v, label: humanise(v) })) },
  { key: 'status', label: 'Status', type: 'select', options: ['active', 'invited', 'deactivated'].map((v) => ({ value: v, label: humanise(v) })) },
]

/** `/staff` (plan/07-admin/12-staff-roles.md section 3). */
export function StaffList() {
  const can = useCan()
  const { menuFor, invite, dialogs } = useStaffActions()
  const [search, setSearch] = useSearchParams()
  useShortcut('c', invite, { label: 'Invite staff', when: can('staff:manage') })
  // the palette's "Invite staff" arrives as ?invite=1: open the dialog once and take the mark off the address
  const wantsInvite = search.get('invite') === '1' && can('staff:manage')
  useEffect(() => {
    if (!wantsInvite) return
    invite()
    setSearch((s) => {
      const next = new URLSearchParams(s)
      next.delete('invite')
      return next
    }, { replace: true })
  }, [wantsInvite]) // eslint-disable-line react-hooks/exhaustive-deps -- once per arrival
  return (
    <>
      <PageHeader
        title="Staff & roles"
        description="Who can sign in to this admin and what they can do."
        actions={
          <>
            <PermissionsButton />
            <LinkButton variant="secondary" href="/staff/roles" render={<RouterLink to="/staff/roles" />}>
              Roles
            </LinkButton>
            {can('staff:manage') ? (
              <Button iconStart={<Plus aria-hidden className="size-4" />} onClick={invite}>
                Invite staff
              </Button>
            ) : null}
          </>
        }
      />
      <DataTable
        id="staff"
        label="Staff"
        searchPlaceholder="Search name or email…"
        schema={staffListSchema}
        query={staffQueries.list}
        columns={columns}
        filters={filters}
        defaultSort="name"
        rowId={(s) => s.id}
        rowLabel={(s) => s.name}
        rowHref={(s) => `/staff/${s.id}`}
        rowActions={menuFor}
        empty={{ title: 'No staff yet' }}
      />
      {dialogs}
    </>
  )
}
