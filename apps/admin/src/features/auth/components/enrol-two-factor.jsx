import { zodResolver } from '@hookform/resolvers/zod'
import { ApiError } from '@noor/contract'
import { Button } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { RHFField } from '@noor/ui/field'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { QrCode } from '@/components/qr-code'
import { downloadBlob } from '@/lib/download'
import { useBeginTwoFactor, useConfirmPassword, useEnableTwoFactor } from '../api'
import { CodeForm } from '../schemas'

/** The secret in groups of four, as authenticator apps show it. @param {string} secret */
const grouped = (secret) => secret.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()

/**
 * Two-step sign-in set-up (plan/07-admin/12-staff-roles.md section 5): scan, enter the first code, keep the recovery codes.
 * @param {{ onDone: () => void; }} props
 */
export function EnrolTwoFactor({ onDone }) {
  const begin = useBeginTwoFactor()
  const enable = useEnableTwoFactor()
  const confirm = useConfirmPassword()
  const [password, setPassword] = useState('')
  const [saved, setSaved] = useState(false)
  const form = useForm({ resolver: zodResolver(CodeForm), defaultValues: { code: '' } })

  if (enable.data) {
    const codes = enable.data.recoveryCodes
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">Keep these recovery codes somewhere safe. Each works once if you lose your phone. They are not shown again.</p>
        <ul className="grid grid-cols-2 gap-2 rounded-control bg-surface-2 p-3 font-mono text-sm" aria-label="Recovery codes">
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void navigator.clipboard?.writeText(codes.join('\n'))}>
            Copy
          </Button>
          <Button variant="secondary" size="sm" onClick={() => downloadBlob('rubaya-recovery-codes.txt', new Blob([`${codes.join('\n')}\n`], { type: 'text/plain' }))}>
            Download .txt
          </Button>
        </div>
        <Checkbox label="I have saved these codes" checked={saved} onCheckedChange={setSaved} />
        <Button fullWidth disabled={!saved} onClick={onDone}>
          Done
        </Button>
      </div>
    )
  }

  if (!begin.data) {
    const stepUp = begin.error instanceof ApiError && begin.error.code === 'step_up_required'
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">You will need an authenticator app on your phone. We show a code to scan, then ask for the first 6-digit code it makes.</p>
        {stepUp ? (
          <Field label="Confirm your password" required>
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
        ) : null}
        <FormError error={stepUp ? confirm.error : begin.error} />
        <Button
          fullWidth
          loading={begin.isPending || confirm.isPending}
          onClick={() => (stepUp ? confirm.mutate(password, { onSuccess: () => begin.mutate() }) : begin.mutate())}
        >
          {stepUp ? 'Confirm and continue' : 'Start set-up'}
        </Button>
      </div>
    )
  }

  const { otpauthUri, secret } = begin.data
  return (
    <form noValidate className="space-y-4" onSubmit={form.handleSubmit((values) => enable.mutate(values.code))}>
      <p className="text-sm">1. Scan this with your authenticator app, or type the key.</p>
      <div className="flex flex-wrap items-center gap-4">
        <QrCode value={otpauthUri} label="QR code for your authenticator app" />
        <p className="font-mono text-sm tracking-wider" aria-label="Setup key">
          {grouped(secret)}
        </p>
      </div>
      <p className="text-sm">2. Enter the 6-digit code it shows.</p>
      <RHFField control={form.control} name="code" label="6-digit code" required>
        {(field) => <Input {...field} inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="one-time-code" required />}
      </RHFField>
      <FormError error={enable.error} />
      <Button type="submit" fullWidth loading={enable.isPending}>
        Verify
      </Button>
    </form>
  )
}

