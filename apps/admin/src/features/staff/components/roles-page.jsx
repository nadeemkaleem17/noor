import { AccessProfileInput } from '@noor/contract'
import { Badge } from '@noor/ui/badge'
import { Button } from '@noor/ui/button'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { Dialog } from '@noor/ui/dialog'
import { EmptyState } from '@noor/ui/empty-state'
import { ErrorState } from '@noor/ui/error-state'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { Skeleton } from '@noor/ui/skeleton'
import { useToast } from '@noor/ui/toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { AppLink } from '@/components/app-link'
import { PageHeader } from '@/components/page-header'
import { api } from '@/lib/api'
import { messageFor } from '@/lib/errors'
import { useCan, useMe } from '@/lib/session'
import { useStepUp, wasCancelled } from '@/lib/step-up'
import { profilesQuery, rolesQuery, staffKeys } from '../api'
import { ModuleMatrix } from './module-matrix'
import { humanise } from './staff-list'

/** @typedef {import('@noor/contract').Permission} Permission */
/** @typedef {import('@noor/contract').AccessProfile} Profile */

const baseRoles = /** @type {const} */ (['manager', 'catalog', 'fulfilment', 'support', 'viewer'])

/**
 * One custom role in the making: a name, the base role it starts from, and the modules ticked in the end. Only what differs from the base role is sent (the server keeps the same).
 * @param {{ profile: Profile | null; onClose: () => void }} props
 */
function RoleEditor({ profile, onClose }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { run, dialog } = useStepUp()
  const me = useMe()
  const roles = useQuery(rolesQuery)
  const [name, setName] = useState(profile?.name ?? '')
  const [summary, setSummary] = useState(profile?.summary ?? '')
  const [baseRole, setBaseRole] = useState(/** @type {Profile['baseRole']} */ (profile?.baseRole ?? 'support'))
  const [grants, setGrants] = useState(/** @type {Permission[]} */ (profile?.grants ?? []))
  const [revokes, setRevokes] = useState(/** @type {Permission[]} */ (profile?.revokes ?? []))
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState('')
  const roleHas = new Set(roles.data?.items.find((r) => r.role === baseRole)?.permissions ?? [])
  const input = { name, ...(summary.trim() ? { summary } : {}), baseRole, grants, revokes }
  const parsed = AccessProfileInput.safeParse(input)

  /** A different base role starts the ticks again: what was added or taken away belonged to the old one. @param {Profile['baseRole']} next */
  function changeBase(next) {
    setBaseRole(next)
    setGrants([])
    setRevokes([])
  }

  async function save() {
    setSaving(true)
    setProblem('')
    try {
      await run(() => (profile ? api('admin.profiles.update', { params: { id: profile.id }, body: /** @type {never} */ ({ ...parsed.data, version: profile.version }) }) : api('admin.profiles.create', { body: /** @type {never} */ (parsed.data) })))
      void queryClient.invalidateQueries({ queryKey: staffKeys.all })
      toast.push({ title: profile ? 'Role saved. Everyone who has it follows.' : 'Role made', tone: 'success' })
      onClose()
    } catch (e) {
      if (!wasCancelled(e)) setProblem(messageFor(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => !open && onClose()}
        size="lg"
        title={profile ? `Change "${profile.name}"` : 'New role'}
        description={profile && profile.members > 0 ? `${profile.members} ${profile.members === 1 ? 'person has' : 'people have'} this role: saving changes their access at once.` : 'A name for a set of access that you can give to people.'}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button loading={saving} disabled={!parsed.success} onClick={() => void save()}>{profile ? 'Save role' : 'Make the role'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required hint="For example Delivery coordinator.">
              <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Starts from" hint="The built-in role this one is like.">
              <NativeSelect value={baseRole} onChange={(e) => changeBase(/** @type {Profile['baseRole']} */ (e.target.value))} options={baseRoles.map((r) => ({ value: r, label: humanise(r) }))} />
            </Field>
          </div>
          <Field label="What it is for">
            <Input value={summary} maxLength={200} onChange={(e) => setSummary(e.target.value)} />
          </Field>
          <ModuleMatrix roleHas={roleHas} grants={grants} revokes={revokes} onGrants={setGrants} onRevokes={setRevokes} editable mine={new Set(me.permissions)} who="this role" />
          {problem ? <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">{problem}</p> : null}
        </div>
      </Dialog>
      {dialog}
    </>
  )
}

/** `/staff/roles`: the built-in roles, and the custom roles staff made from them (plan/17-owner-requests-2026-10.md item 11). A role is given to a person from their own page. */
export function RolesPage() {
  const can = useCan()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { run, dialog } = useStepUp()
  const roles = useQuery(rolesQuery)
  const profiles = useQuery(profilesQuery)
  const [editing, setEditing] = useState(/** @type {Profile | 'new' | null} */ (null))
  const [deleting, setDeleting] = useState(/** @type {Profile | null} */ (null))
  const manage = can('staff:manage')
  return (
    <>
      <AppLink to="/staff" className="mb-2 inline-flex items-center gap-1 text-sm text-accent-text">Staff</AppLink>
      <PageHeader
        title="Roles"
        description="What each kind of person may do. Make a role of your own from a built-in one, then give it to people from their page: changing the role changes everyone who has it."
        actions={manage ? <Button onClick={() => setEditing('new')}>New role</Button> : null}
      />
      <section aria-labelledby="custom-roles" className="mb-8">
        <h2 id="custom-roles" className="mb-2 font-heading text-lg font-semibold">Your roles</h2>
        {profiles.isPending ? <Skeleton className="h-24 w-full" /> : null}
        {profiles.isError ? <ErrorState title="The roles could not be loaded" retryLabel="Try again" onRetry={() => void profiles.refetch()} /> : null}
        {profiles.isSuccess && profiles.data.items.length === 0 ? <EmptyState title="No role of your own yet" body="The built-in roles below cover most shops. Make one when a person needs something in between." /> : null}
        {profiles.isSuccess && profiles.data.items.length > 0 ? (
          <ul className="space-y-3">
            {profiles.data.items.map((p) => (
              <li key={p.id} className="rounded-card border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{p.name}</h3>
                  <Badge>{`Like ${humanise(p.baseRole)}`}</Badge>
                  <Badge tone="accent">{p.members === 1 ? '1 person' : `${p.members} people`}</Badge>
                  {manage ? (
                    <span className="ms-auto flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(p)}>Change</Button>
                      <Button size="sm" variant="secondary" onClick={() => setDeleting(p)}>Delete</Button>
                    </span>
                  ) : null}
                </div>
                {p.summary ? <p className="mt-1 text-sm text-fg-soft">{p.summary}</p> : null}
                <p className="mt-2 text-xs text-muted">
                  {p.grants.length > 0 ? `${p.grants.length} added to ${humanise(p.baseRole)}` : 'Nothing added'} · {p.revokes.length > 0 ? `${p.revokes.length} taken away` : 'nothing taken away'}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section aria-labelledby="built-in-roles">
        <h2 id="built-in-roles" className="mb-2 font-heading text-lg font-semibold">Built-in roles</h2>
        {roles.isSuccess ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {roles.data.items.map((r) => (
              <li key={r.role} className="rounded-card border border-line bg-surface p-4">
                <h3 className="font-medium">{r.label}</h3>
                <p className="mt-1 text-sm text-fg-soft">{r.summary}</p>
                <p className="mt-2 text-xs text-muted">{r.permissions.length} permissions{r.twoFactorRequired ? ' · two-step sign-in required' : ''}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      {editing ? <RoleEditor key={editing === 'new' ? 'new' : editing.id} profile={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.name ?? ''}"?`}
        body={deleting && deleting.members > 0 ? `The ${deleting.members} ${deleting.members === 1 ? 'person keeps' : 'people keep'} the access they have now; it simply stops following this role.` : 'No one has this role.'}
        confirmLabel="Delete the role"
        tone="danger"
        onConfirm={async () => {
          const target = deleting
          if (!target) return
          try {
            await run(() => api('admin.profiles.delete', { params: { id: target.id } }))
            void queryClient.invalidateQueries({ queryKey: staffKeys.all })
            toast.push({ title: 'Role deleted', tone: 'success' })
          } catch (e) {
            if (!wasCancelled(e)) toast.push({ title: messageFor(e), tone: 'danger' })
          }
        }}
      />
      {dialog}
    </>
  )
}
