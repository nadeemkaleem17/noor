import { z } from '@noor/contract'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@noor/ui/button'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { Dialog } from '@noor/ui/dialog'
import { RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { useToast } from '@noor/ui/toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, LogOut, Mail, Pencil, ShieldOff, UserCheck, UserX } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { api } from '@/lib/api'
import { messageFor } from '@/lib/errors'
import { useCan, useMe } from '@/lib/session'
import { useStepUp, wasCancelled } from '@/lib/step-up'
import { rolesQuery, staffKeys } from '../api'

/** @typedef {import('@noor/contract').StaffUser} Staff */

const Invite = z.object({ name: z.string().trim().min(1, 'required').max(100, 'too_long'), email: z.string().trim().min(1, 'required').pipe(z.email('email_invalid')), role: z.string().min(1, 'required') })
const Edit = z.object({ name: z.string().trim().min(1, 'required').max(100, 'too_long'), role: z.string().min(1, 'required') })

/** @param {{ staff?: Staff; onClose: () => void; onDone: (saved: Staff & { inviteLink?: string; }) => void; run: ReturnType<typeof useStepUp>['run']; }} props */
function StaffFormDialog({ staff, onClose, onDone, run }) {
  const roles = useQuery(rolesQuery)
  const [error, setError] = useState(/** @type {unknown} */ (null))
  const [pending, setPending] = useState(false)
  const form = useForm({
    defaultValues: { name: staff?.name ?? '', email: staff?.email ?? '', role: staff?.role ?? '' },
    resolver: /** @type {import('react-hook-form').Resolver<{ name: string; email: string; role: string; }>} */ (/** @type {unknown} */ (zodResolver(staff ? Edit : Invite))),
  })
  const chosen = useWatch({ control: form.control, name: 'role' })
  const options = (roles.data?.items ?? []).map((r) => ({ value: r.role, label: r.label }))

  async function save(/** @type {{ name: string; email: string; role: string; }} */ v) {
    setPending(true)
    setError(null)
    try {
      const role = /** @type {Staff['role']} */ (v.role)
      const saved = staff
        ? await run(() => api('admin.staff.update', { params: { id: staff.id }, body: { name: v.name.trim(), role, version: staff.version } }))
        : await run(() => api('admin.staff.invite', { body: { name: v.name.trim(), email: v.email.trim(), role } }))
      onDone(saved)
    } catch (e) {
      if (!wasCancelled(e)) setError(e)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={staff ? `Edit ${staff.name}` : 'Invite staff'}
      description={staff ? 'Changing the role signs them out everywhere.' : 'They get a link to choose a password. It works for 7 days.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="staff-form" loading={pending}>
            {staff ? 'Save' : 'Invite'}
          </Button>
        </>
      }
    >
      <form id="staff-form" noValidate className="space-y-3" onSubmit={(e) => void form.handleSubmit(save)(e)}>
        <RHFField control={form.control} name="name" label="Name" required>
          {(field) => <Input {...field} maxLength={100} required autoComplete="off" />}
        </RHFField>
        {staff ? null : (
          <RHFField control={form.control} name="email" label="Email" required>
            {(field) => <Input {...field} type="email" required autoComplete="off" />}
          </RHFField>
        )}
        <RHFField control={form.control} name="role" label="Role" required hint={roles.data?.items.find((r) => r.role === chosen)?.summary}>
          {(field) => <NativeSelect {...field} placeholder="Choose a role" options={options} />}
        </RHFField>
        <FormError error={error} />
      </form>
    </Dialog>
  )
}

/** A link that is shown once: it is not stored anywhere the screen can read it again. @param {{ title: string; url: string; onClose: () => void; }} props */
function LinkDialog({ title, url, onClose }) {
  const toast = useToast()
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description="Send this link to them privately. It is shown only now."
      footer={
        <>
          <Button variant="secondary" onClick={() => void navigator.clipboard?.writeText(url).then(() => toast.push({ title: 'Link copied', tone: 'success' }))}>
            Copy link
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <p className="break-all rounded-control bg-surface-2 p-3 font-mono text-sm" aria-label="Link">
        {url}
      </p>
    </Dialog>
  )
}

/**
 * Everything staff management can do to a person, and the dialogs it needs. One place for the list and the detail screen.
 * `menuFor(person)` gives the row menu; render `dialogs` once. Each sensitive call repeats itself after the password was confirmed.
 */
export function useStaffActions() {
  const can = useCan()
  const me = useMe()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { run, dialog } = useStepUp()
  const [open, setOpen] = useState(/** @type {{ kind: 'invite' | 'edit' | 'password-reset' | 'resend' | 'reset-2fa' | 'sign-out' | 'deactivate' | 'reactivate' | 'unlock'; staff?: Staff; } | null} */ (null))
  const [link, setLink] = useState(/** @type {{ title: string; url: string; } | null} */ (null))
  const refresh = () => queryClient.invalidateQueries({ queryKey: staffKeys.all })

  /** What each confirmation asks and does. `link` makes the result a one-time link. */
  const confirmations = /** @type {Record<string, { title: (s: Staff) => string; body: string; label: string; tone?: 'danger' | 'accent'; call: (s: Staff) => Promise<any>; done: string; link?: 'resetLink' | 'inviteLink'; }>} */ ({
    'password-reset': { title: (s) => `Reset the password of ${s.name}?`, body: 'They are signed out everywhere. You get a one-time link to send them.', label: 'Reset password', call: (s) => api('admin.staff.resetPassword', { params: { id: s.id } }), done: 'Password reset', link: 'resetLink' },
    resend: { title: (s) => `Send ${s.name} a new invite?`, body: 'The old link stops working.', label: 'Resend invite', tone: 'accent', call: (s) => api('admin.staff.resendInvite', { params: { id: s.id } }), done: 'New invite made', link: 'inviteLink' },
    'reset-2fa': { title: (s) => `Reset two-step sign-in for ${s.name}?`, body: 'Their authenticator and recovery codes are removed. They set it up again the next time they sign in.', label: 'Reset two-step', call: (s) => api('admin.staff.resetTwoFactor', { params: { id: s.id } }), done: 'Two-step sign-in reset' },
    'sign-out': { title: (s) => `Sign ${s.name} out everywhere?`, body: 'Every session of theirs ends now.', label: 'Sign out everywhere', call: (s) => api('admin.staff.revokeSessions', { params: { id: s.id } }), done: 'Signed out everywhere' },
    deactivate: { title: (s) => `Deactivate ${s.name}?`, body: 'They cannot sign in and their sessions end. Their name stays on past activity. You can reactivate them later.', label: 'Deactivate', call: (s) => api('admin.staff.deactivate', { params: { id: s.id } }), done: 'Deactivated' },
    reactivate: { title: (s) => `Reactivate ${s.name}?`, body: 'They can sign in again.', label: 'Reactivate', tone: 'accent', call: (s) => api('admin.staff.reactivate', { params: { id: s.id } }), done: 'Reactivated' },
    unlock: { title: (s) => `Unlock ${s.name}?`, body: 'Too many wrong passwords locked the account for a while. This lets them try again now.', label: 'Unlock', tone: 'accent', call: (s) => api('admin.staff.clearLock', { params: { id: s.id } }), done: 'Unlocked' },
  })

  /** @param {Staff} s */
  function menuFor(s) {
    if (!can('staff:manage') || s.id === me.id) return [] // changes to yourself are made on My account
    /** @param {NonNullable<typeof open>['kind']} kind */
    const at = (kind) => () => setOpen({ kind, staff: s })
    const item = (/** @type {import('react').ReactNode} */ label, /** @type {import('react').ReactNode} */ icon, /** @type {NonNullable<typeof open>['kind']} */ kind, tone = /** @type {'neutral' | 'danger'} */ ('neutral')) => ({ label, icon, onSelect: at(kind), tone })
    if (s.status === 'deactivated') return [item('Reactivate', <UserCheck aria-hidden className="size-4" />, 'reactivate')]
    return [
      item('Edit', <Pencil aria-hidden className="size-4" />, 'edit'),
      ...(s.status === 'invited' ? [item('Resend invite', <Mail aria-hidden className="size-4" />, 'resend')] : [item('Reset password', <KeyRound aria-hidden className="size-4" />, 'password-reset')]),
      ...(s.twoFactorEnabled ? [item('Reset two-step sign-in', <ShieldOff aria-hidden className="size-4" />, 'reset-2fa')] : []),
      ...(s.lockedUntil && new Date(s.lockedUntil) > new Date() ? [item('Unlock', <KeyRound aria-hidden className="size-4" />, 'unlock')] : []),
      ...(s.status === 'active' ? [item('Sign out everywhere', <LogOut aria-hidden className="size-4" />, 'sign-out')] : []),
      item('Deactivate', <UserX aria-hidden className="size-4" />, 'deactivate', 'danger'),
    ]
  }

  const kind = open?.kind
  const confirmation = kind ? confirmations[kind] : undefined
  const dialogs = (
    <>
      {kind === 'invite' || kind === 'edit' ? (
        <StaffFormDialog
          key={open?.staff?.id ?? 'new'}
          staff={open?.staff}
          run={run}
          onClose={() => setOpen(null)}
          onDone={(saved) => {
            setOpen(null)
            void refresh()
            if (saved.inviteLink) setLink({ title: `Invite link for ${saved.name}`, url: saved.inviteLink })
            else toast.push({ title: kind === 'invite' ? 'Invite made' : 'Saved', tone: 'success' })
          }}
        />
      ) : null}
      {confirmation && open?.staff ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && setOpen(null)}
          tone={confirmation.tone ?? 'danger'}
          title={confirmation.title(open.staff)}
          body={confirmation.body}
          confirmLabel={confirmation.label}
          onConfirm={async () => {
            const staff = /** @type {Staff} */ (open.staff)
            try {
              const result = await run(() => confirmation.call(staff))
              await refresh()
              setOpen(null)
              const url = confirmation.link ? result?.[confirmation.link] : undefined
              if (url) setLink({ title: confirmation.link === 'resetLink' ? `Password reset link for ${staff.name}` : `Invite link for ${staff.name}`, url })
              else toast.push({ title: confirmation.done, tone: 'success' })
            } catch (e) {
              if (!wasCancelled(e)) toast.push({ title: messageFor(e), tone: 'danger' })
              throw e
            }
          }}
        />
      ) : null}
      {link ? <LinkDialog title={link.title} url={link.url} onClose={() => setLink(null)} /> : null}
      {dialog}
    </>
  )

  return { menuFor, invite: () => setOpen({ kind: 'invite' }), dialogs }
}
