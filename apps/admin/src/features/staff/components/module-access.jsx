import { permissionModules } from '@noor/contract'
import { Badge } from '@noor/ui/badge'
import { Button } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { useToast } from '@noor/ui/toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { SectionCard } from '@/components/section-card'
import { api } from '@/lib/api'
import { messageFor } from '@/lib/errors'
import { permissionLabels } from '@/lib/permission-labels'
import { useMe } from '@/lib/session'
import { useStepUp, wasCancelled } from '@/lib/step-up'
import { rolesQuery, staffKeys } from '../api'

/** @typedef {import('@noor/contract').Permission} Permission */

/**
 * "Module access" of one person: the role they have, and, module by module, what is added to it or taken from it for them alone (plan/17-owner-requests-2026-10.md item 11).
 * A checkbox that is ticked means the person may; a note says whether that is the role's doing or an addition, and an unticked box whether it was taken away. Nothing is saved until Save.
 * @param {{ staff: import('@noor/contract').StaffUser; canEdit: boolean }} props
 */
export function ModuleAccess({ staff, canEdit }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { run, dialog } = useStepUp()
  const me = useMe()
  const roles = useQuery(rolesQuery)
  const [grants, setGrants] = useState(/** @type {Permission[]} */ (staff.grants))
  const [revokes, setRevokes] = useState(/** @type {Permission[]} */ (staff.revokes))
  const roleHas = new Set(roles.data?.items.find((r) => r.role === staff.role)?.permissions ?? [])
  const mine = new Set(me.permissions)
  const owner = staff.role === 'owner'
  const own = me.id === staff.id
  const dirty = JSON.stringify([...grants].sort()) !== JSON.stringify([...staff.grants].sort()) || JSON.stringify([...revokes].sort()) !== JSON.stringify([...staff.revokes].sort())
  const editable = canEdit && !owner && !own

  /** Does the person have it now, with the changes on screen? @param {Permission} p */
  const has = (p) => (roleHas.has(p) && !revokes.includes(p)) || grants.includes(p)
  /** @param {Permission} p @param {boolean} on */
  function set(p, on) {
    if (roleHas.has(p)) setRevokes((r) => (on ? r.filter((x) => x !== p) : [...r, p]))
    else setGrants((g) => (on ? [...g, p] : g.filter((x) => x !== p)))
  }
  /** Switch a whole module off or back to the role. @param {readonly Permission[]} list @param {'off' | 'role'} how */
  function module_(list, how) {
    if (how === 'off') {
      setRevokes((r) => [...new Set([...r, ...list.filter((p) => roleHas.has(p))])])
      setGrants((g) => g.filter((p) => !list.includes(p)))
    } else {
      setRevokes((r) => r.filter((p) => !list.includes(p)))
      setGrants((g) => g.filter((p) => !list.includes(p)))
    }
  }

  const save = useMutation({
    mutationFn: () => run(() => api('admin.staff.setPermissions', { params: { id: staff.id }, body: { grants, revokes, version: staff.version } })),
    onSuccess: (saved) => {
      queryClient.setQueryData([...staffKeys.all, 'detail', staff.id], (/** @type {any} */ old) => ({ ...old, ...saved }))
      void queryClient.invalidateQueries({ queryKey: [...staffKeys.all, 'list'] })
      toast.push({ title: 'Access saved', tone: 'success' })
    },
    onError: (e) => {
      if (!wasCancelled(e)) toast.push({ title: messageFor(e), tone: 'danger' })
    },
  })

  return (
    <SectionCard
      id="access"
      title="Module access"
      description={`Starts from the ${staff.role} role. Tick or untick what this person alone may do; the role itself is not changed.`}
    >
      {owner ? <p className="text-sm text-muted">An owner may do everything, and nothing can be taken away.</p> : null}
      {own && !owner ? <p className="text-sm text-muted">Nobody changes their own access. Ask an owner.</p> : null}
      <div className="space-y-4">
        {permissionModules.map((m) => {
          const list = /** @type {readonly Permission[]} */ (m.permissions)
          const n = list.filter(has).length
          return (
            <fieldset key={m.id} className="rounded-card border border-line p-3">
              <legend className="flex flex-wrap items-center gap-2 px-1 font-medium">
                {m.label}
                <Badge tone={n === 0 ? 'neutral' : n === list.length ? 'success' : 'accent'}>{n === 0 ? 'No access' : n === list.length ? 'Full access' : `${n} of ${list.length}`}</Badge>
              </legend>
              <ul className="grid gap-1 sm:grid-cols-2">
                {list.map((p) => {
                  const note = grants.includes(p) ? 'added for this person' : revokes.includes(p) ? 'taken away' : roleHas.has(p) ? 'from the role' : ''
                  // nobody gives what they do not hold themselves
                  const mayChange = editable && (roleHas.has(p) || has(p) || mine.has(p))
                  return (
                    <li key={p}>
                      <Checkbox label={<span>{permissionLabels[p]}{note ? <span className="ms-1 text-xs text-muted">({note})</span> : null}</span>} checked={has(p)} disabled={!mayChange} onCheckedChange={(on) => set(p, on === true)} />
                    </li>
                  )
                })}
              </ul>
              {editable ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => module_(list, 'off')}>
                    Take away all of {m.label.split(',')[0]?.toLowerCase()}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => module_(list, 'role')}>
                    Back to the role
                  </Button>
                </div>
              ) : null}
            </fieldset>
          )
        })}
      </div>
      {editable ? (
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={!dirty} onClick={() => (setGrants(staff.grants), setRevokes(staff.revokes))}>
            Discard changes
          </Button>
          <Button type="button" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>
            Save access
          </Button>
        </div>
      ) : null}
      {dialog}
    </SectionCard>
  )
}
