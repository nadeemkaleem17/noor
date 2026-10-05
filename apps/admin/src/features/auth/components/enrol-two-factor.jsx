import { zodResolver } from '@hookform/resolvers/zod'
import { ApiError } from '@noor/contract'
import { Button } from '@noor/ui/button'
import { RHFField } from '@noor/ui/field'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { QrCode } from '@/components/qr-code'
import { RecoveryCodes } from '@/components/recovery-codes'
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
  const form = useForm({ resolver: zodResolver(CodeForm), defaultValues: { code: '' } })

  if (enable.data) return <RecoveryCodes codes={enable.data.recoveryCodes} onDone={onDone} />

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

