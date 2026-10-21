import { NativeSelect } from '@noor/ui/native-select'
import { useToast } from '@noor/ui/toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SectionCard } from '@/components/section-card'
import { Field } from '@noor/ui/field'
import { api } from '@/lib/api'
import { messageFor } from '@/lib/errors'
import { useMe } from '@/lib/session'
import { useStepUp, wasCancelled } from '@/lib/step-up'
import { profilesQuery, staffKeys } from '../api'
import { humanise } from './staff-list'

/**
 * The custom role of one person (plan/17-owner-requests-2026-10.md item 11): choosing one makes their role and their additions and removals the role's; "none" lets go of it and leaves the access as
 * it is. Module access below can still change one person alone, which also lets go of the role.
 * @param {{ staff: import('@noor/contract').StaffUser; canEdit: boolean }} props
 */
export function ProfilePicker({ staff, canEdit }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { run, dialog } = useStepUp()
  const me = useMe()
  const profiles = useQuery(profilesQuery)
  const owner = staff.role === 'owner'
  const own = me.id === staff.id
  const current = profiles.data?.items.find((p) => p.id === staff.profileId)
  const apply = useMutation({
    mutationFn: (/** @type {string | null} */ profileId) => run(() => api('admin.staff.applyProfile', { params: { id: staff.id }, body: { profileId, version: staff.version } })),
    onSuccess: (saved) => {
      queryClient.setQueryData([...staffKeys.all, 'detail', staff.id], (/** @type {any} */ old) => ({ ...old, ...saved }))
      void queryClient.invalidateQueries({ queryKey: [...staffKeys.all] })
      toast.push({ title: 'Role changed', tone: 'success' })
    },
    onError: (e) => {
      if (!wasCancelled(e)) toast.push({ title: messageFor(e), tone: 'danger' })
    },
  })
  // nothing to show (and nothing to choose from) until the shop has made a role of its own, unless this person already has one
  if (profiles.isSuccess && profiles.data.items.length === 0 && !staff.profileId) return null
  const disabled = !canEdit || owner || own || apply.isPending
  return (
    <SectionCard id="custom-role" title="Role" description="A role you made, if this person has one. Changing the role changes their access straight away.">
      <Field label="Role" hint={current ? `Like ${humanise(current.baseRole)}${current.summary ? `: ${current.summary}` : ''}` : staff.profileId ? undefined : 'No role of your own: they have the built-in role and any changes made to them alone.'}>
        <NativeSelect
          value={staff.profileId ?? ''}
          disabled={disabled}
          onChange={(e) => apply.mutate(e.target.value || null)}
          options={[{ value: '', label: 'None (as they are now)' }, ...(profiles.data?.items.map((p) => ({ value: p.id, label: p.name })) ?? [])]}
        />
      </Field>
      {dialog}
    </SectionCard>
  )
}
