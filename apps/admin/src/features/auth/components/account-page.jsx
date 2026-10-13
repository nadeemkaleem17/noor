import { zodResolver } from '@hookform/resolvers/zod'
import { z } from '@noor/contract'
import { Badge } from '@noor/ui/badge'
import { Button } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { Dialog } from '@noor/ui/dialog'
import { Field, RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { Spinner } from '@noor/ui/spinner'
import { Table, Td, Th } from '@noor/ui/table'
import { useToast } from '@noor/ui/toast'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { PageHeader } from '@/components/page-header'
import { RecoveryCodes } from '@/components/recovery-codes'
import { SectionCard } from '@/components/section-card'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/dates'
import { messageFor } from '@/lib/errors'
import { setPrefs, usePrefs } from '@/lib/prefs'
import { useMe } from '@/lib/session'
import { useStepUp, wasCancelled } from '@/lib/step-up'
import { sessionsQuery, useChangePassword, useRefreshMe, useSessionMutations, useUpdateProfile } from '../api'
import { NewPasswordForm } from '../schemas'
import { EnrolTwoFactor } from './enrol-two-factor'

/** "Chrome on Windows" from a user-agent string: enough to tell one's own devices apart. @param {string} ua */
export function describeAgent(ua) {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'A browser'
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'an unknown system'
  return `${browser} on ${os}`
}

const humanise = (/** @type {string} */ v) => v.replace(/^./, (c) => c.toUpperCase())

function ProfileCard() {
  const me = useMe()
  const toast = useToast()
  const update = useUpdateProfile()
  const form = useForm({ defaultValues: { name: me.name }, resolver: zodResolver(z.object({ name: z.string().trim().min(1, 'required').max(100, 'too_long') })) })
  function save(/** @type {{ name: string; }} */ v) {
    update.mutate(v.name, { onSuccess: () => (form.reset({ name: v.name.trim() }), toast.push({ title: 'Profile saved', tone: 'success' })) }) // a failure shows under the form
  }
  return (
    <SectionCard id="profile" title="Profile">
      <form noValidate className="space-y-4" onSubmit={(e) => void form.handleSubmit(save)(e)}>
        <RHFField control={form.control} name="name" label="Name" required>
          {(field) => <Input {...field} maxLength={100} required autoComplete="name" />}
        </RHFField>
        <Field label="Email" hint="Only an owner can change it.">
          <Input value={me.email} readOnly />
        </Field>
        <Field label="Role" hint="Only an owner or manager can change it.">
          <Input value={humanise(me.role)} readOnly />
        </Field>
        <FormError error={update.error} />
        <div className="flex justify-end">
          <Button type="submit" loading={update.isPending} disabled={Object.keys(form.formState.dirtyFields).length === 0}>
            Save profile
          </Button>
        </div>
      </form>
    </SectionCard>
  )
}

const PasswordForm = NewPasswordForm.and(z.object({ currentPassword: z.string().min(1, 'required') }))

function PasswordCard() {
  const toast = useToast()
  const change = useChangePassword()
  const form = useForm({ defaultValues: { currentPassword: '', password: '', confirm: '' }, resolver: zodResolver(PasswordForm) })
  function save(/** @type {{ currentPassword: string; password: string; }} */ v) {
    change.mutate({ currentPassword: v.currentPassword, newPassword: v.password }, { onSuccess: () => (form.reset(), toast.push({ title: 'Password changed. Your other sessions were signed out.', tone: 'success' })) })
  }
  return (
    <SectionCard id="password" title="Password" description="Changing it signs you out everywhere else.">
      <form noValidate className="space-y-4" onSubmit={(e) => void form.handleSubmit(save)(e)}>
        <RHFField control={form.control} name="currentPassword" label="Current password" required>
          {(field) => <Input {...field} type="password" autoComplete="current-password" required />}
        </RHFField>
        <RHFField control={form.control} name="password" label="New password" hint="At least 12 characters. A phrase is easier to remember than a jumble." required>
          {(field) => <Input {...field} type="password" autoComplete="new-password" required />}
        </RHFField>
        <RHFField control={form.control} name="confirm" label="Repeat the new password" required>
          {(field) => <Input {...field} type="password" autoComplete="new-password" required />}
        </RHFField>
        <FormError error={change.error} />
        <div className="flex justify-end">
          <Button type="submit" loading={change.isPending}>
            Change password
          </Button>
        </div>
      </form>
    </SectionCard>
  )
}

function TwoFactorCard() {
  const me = useMe()
  const toast = useToast()
  const refresh = useRefreshMe()
  const { run, dialog } = useStepUp()
  const [mode, setMode] = useState(/** @type {'enrol' | 'codes' | 'off' | null} */ (null))
  const [codes, setCodes] = useState(/** @type {string[]} */ ([]))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(/** @type {unknown} */ (null))

  async function regenerate() {
    setBusy(true)
    setError(null)
    try {
      const result = await run(() => api('admin.me.twoFactor.regenerateCodes'))
      setCodes(result.recoveryCodes)
      setMode('codes')
    } catch (e) {
      if (!wasCancelled(e)) setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SectionCard id="two-factor" title="Two-step sign-in" description="A code from an authenticator app, asked for when you sign in.">
      <p className="flex items-center gap-2 text-sm">
        Status: {me.twoFactorEnabled ? <Badge tone="success">On</Badge> : <Badge tone={me.twoFactorRequired ? 'danger' : 'neutral'}>Off</Badge>}
        {me.twoFactorRequired ? <span className="text-muted">Your role needs it.</span> : null}
      </p>
      <FormError error={error} />
      <div className="flex flex-wrap gap-2">
        {me.twoFactorEnabled ? (
          <>
            <Button variant="secondary" loading={busy} onClick={() => void regenerate()}>
              New recovery codes
            </Button>
            {me.twoFactorRequired ? null : (
              <Button variant="secondary" onClick={() => setMode('off')}>
                Turn off
              </Button>
            )}
          </>
        ) : (
          <Button onClick={() => setMode('enrol')}>Set up</Button>
        )}
      </div>
      <Dialog open={mode === 'enrol'} onOpenChange={(open) => !open && setMode(null)} title="Set up two-step sign-in">
        <EnrolTwoFactor onDone={() => (setMode(null), void refresh())} />
      </Dialog>
      <Dialog open={mode === 'codes'} onOpenChange={() => {}} dismissible={false} title="Your new recovery codes" description="The old codes no longer work.">
        <RecoveryCodes codes={codes} onDone={() => (setMode(null), setCodes([]))} />
      </Dialog>
      <ConfirmDialog
        open={mode === 'off'}
        onOpenChange={(open) => !open && setMode(null)}
        title="Turn off two-step sign-in?"
        body="Signing in will need only your password. Turn it back on any time."
        confirmLabel="Turn off"
        onConfirm={async () => {
          try {
            await run(() => api('admin.me.twoFactor.disable'))
            await refresh()
            toast.push({ title: 'Two-step sign-in is off', tone: 'success' })
          } catch (e) {
            if (!wasCancelled(e)) toast.push({ title: messageFor(e), tone: 'danger' })
            throw e
          }
        }}
      />
      {dialog}
    </SectionCard>
  )
}

function SessionsCard() {
  const toast = useToast()
  const sessions = useQuery(sessionsQuery)
  const { revoke, revokeOthers } = useSessionMutations()
  const items = sessions.data?.items ?? []
  const fail = (/** @type {unknown} */ e) => toast.push({ title: messageFor(e), tone: 'danger' })
  return (
    <SectionCard id="sessions" title="Sessions" description="Where you are signed in. Sign out of any you do not recognise.">
      {sessions.isPending ? <Spinner label="Loading sessions" /> : null}
      {items.length > 0 ? (
        <Table label="Sessions">
          <caption className="sr-only">Your sessions</caption>
          <thead>
            <tr>
              <Th>Device</Th>
              <Th>IP address</Th>
              <Th>Signed in</Th>
              <Th>Last active</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <Td>
                  {describeAgent(s.userAgent)} {s.current ? <Badge tone="success">This device</Badge> : null}
                </Td>
                <Td className="font-mono text-sm">{s.ip}</Td>
                <Td>{formatDateTime(s.createdAt)}</Td>
                <Td>{formatDateTime(s.lastSeenAt)}</Td>
                <Td>
                  {s.current ? null : (
                    <Button variant="link" aria-label={`Sign out ${describeAgent(s.userAgent)}, ${s.ip}`} onClick={() => revoke.mutate(s.id, { onError: fail })}>
                      Sign out
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
      {items.some((s) => !s.current) ? (
        <div>
          <Button variant="secondary" loading={revokeOthers.isPending} onClick={() => revokeOthers.mutate(undefined, { onSuccess: () => toast.push({ title: 'Other sessions signed out', tone: 'success' }), onError: fail })}>
            Sign out all other sessions
          </Button>
        </div>
      ) : null}
    </SectionCard>
  )
}

/** Kept in this browser only (plan/03 section 6), so they are not part of any account on the server. */
function PreferencesCard() {
  const prefs = usePrefs()
  return (
    <SectionCard id="preferences" title="Preferences" description="Saved in this browser only.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Theme">
          <NativeSelect
            value={prefs.theme}
            onChange={(e) => setPrefs({ theme: /** @type {'light' | 'dark' | 'system'} */ (e.target.value) })}
            options={[
              { value: 'system', label: 'Same as my device' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Field>
        <Field label="Table density">
          <NativeSelect
            value={prefs.density}
            onChange={(e) => setPrefs({ density: /** @type {'comfortable' | 'compact'} */ (e.target.value) })}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
        </Field>
      </div>
      <Checkbox
        label="Enable single-key shortcuts"
        checked={prefs.singleKeyShortcuts}
        onCheckedChange={(on) => setPrefs({ singleKeyShortcuts: on })}
      />
      <p className="text-sm text-muted">Keys like j, k, c and g then o work when you are not typing. Switched off, only the ones with Ctrl or Command remain. Press ? to see them.</p>
    </SectionCard>
  )
}

/** `/account` (plan/07-admin/12-staff-roles.md section 6). */
export function AccountPage() {
  return (
    <>
      <PageHeader title="My account" />
      <div className="max-w-3xl space-y-6">
        <ProfileCard />
        <PasswordCard />
        <TwoFactorCard />
        <SessionsCard />
        <PreferencesCard />
      </div>
    </>
  )
}
