import { Button } from '@noor/ui/button'
import { useToast } from '@noor/ui/toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { SectionCard } from '@/components/section-card'
import { api } from '@/lib/api'
import { messageFor } from '@/lib/errors'
import { useMe } from '@/lib/session'
import { useStepUp, wasCancelled } from '@/lib/step-up'
import { rolesQuery, staffKeys } from '../api'
import { ModuleMatrix } from './module-matrix'

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
      <ModuleMatrix roleHas={roleHas} grants={grants} revokes={revokes} onGrants={setGrants} onRevokes={setRevokes} editable={editable} mine={mine} who="this person" />
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
