import { Button } from '@noor/ui/button'
import { ErrorState } from '@noor/ui/error-state'
import { Menu } from '@noor/ui/menu'
import { Spinner } from '@noor/ui/spinner'
import { Table, Td, Th } from '@noor/ui/table'
import { useQuery } from '@tanstack/react-query'
import { Ellipsis } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { SectionCard } from '@/components/section-card'
import { formatDateTime, relativeTime } from '@/lib/dates'
import { staffQueries } from '../api'
import { useStaffActions } from './staff-actions'
import { StatusCell, TwoFactorBadge, humanise } from './staff-list'

/** A browser name from a user-agent string: enough to tell sessions apart. @param {string} ua */
const browser = (ua) => (/Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'A browser')

/** @param {{ label: string; children: import('react').ReactNode; }} props */
const Item = ({ label, children }) => (
  <div>
    <dt className="text-muted">{label}</dt>
    <dd>{children}</dd>
  </div>
)

/** `/staff/:id` (plan/07-admin/12-staff-roles.md section 3): one person, their sessions and the same actions as the list. @param {{ id: string; }} props */
export function StaffDetail({ id }) {
  const person = useQuery(staffQueries.detail(id))
  const { menuFor, dialogs } = useStaffActions()
  if (person.isPending) return <Spinner label="Loading staff member" />
  if (person.isError) return <ErrorState title="This person could not be loaded" retryLabel="Try again" onRetry={() => void person.refetch()} />
  const s = person.data
  const items = menuFor(s)
  return (
    <>
      <PageHeader
        title={s.name}
        description={s.email}
        actions={
          items.length ? (
            <Menu
              align="end"
              trigger={
                <Button variant="secondary" iconEnd={<Ellipsis aria-hidden className="size-4" />}>
                  Actions
                </Button>
              }
              items={items}
            />
          ) : null
        }
      />
      <div className="max-w-3xl space-y-6">
        <SectionCard id="details" title="Details">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Item label="Role">{humanise(s.role)}</Item>
            <Item label="Status">
              <StatusCell staff={s} />
            </Item>
            <Item label="Two-step sign-in">
              <TwoFactorBadge staff={s} />
            </Item>
            <Item label="Last active">{s.lastSeenAt ? relativeTime(s.lastSeenAt) : 'Never'}</Item>
            <Item label="Added">{formatDateTime(s.createdAt)}</Item>
          </dl>
        </SectionCard>
        <SectionCard id="sessions" title="Sessions">
          {s.sessions.length === 0 ? (
            <p className="text-sm text-muted">Not signed in anywhere.</p>
          ) : (
            <Table label="Sessions">
              <caption className="sr-only">Sessions</caption>
              <thead>
                <tr>
                  <Th>Browser</Th>
                  <Th>IP address</Th>
                  <Th>Signed in</Th>
                  <Th>Last active</Th>
                </tr>
              </thead>
              <tbody>
                {s.sessions.map((x) => (
                  <tr key={x.id}>
                    <Td>{browser(x.userAgent)}</Td>
                    <Td className="font-mono text-sm">{x.ip}</Td>
                    <Td>{formatDateTime(x.createdAt)}</Td>
                    <Td>{formatDateTime(x.lastSeenAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </SectionCard>
      </div>
      {dialogs}
    </>
  )
}
