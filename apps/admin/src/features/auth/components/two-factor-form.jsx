import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@noor/ui/button'
import { RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { ApiError } from '@noor/contract'
import { FormError } from '@/components/form-error'
import { useContinueAfterSignIn, useVerifyTwoFactor } from '../api'
import { CodeForm, RecoveryForm } from '../schemas'

/** The six-digit code, or a recovery code. Five wrong codes end the pending session; the API then answers 401 and we go back to the start. */
export function TwoFactorFormView() {
  const [recovery, setRecovery] = useState(false)
  const verify = useVerifyTwoFactor()
  const proceed = useContinueAfterSignIn()
  const navigate = useNavigate()
  const form = useForm({ resolver: zodResolver(recovery ? RecoveryForm : CodeForm), defaultValues: { code: '', recoveryCode: '' } })
  const name = recovery ? 'recoveryCode' : 'code'
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit((values) => {
        const v = /** @type {{ code?: string; recoveryCode?: string; }} */ (values)
        const body = recovery ? { recoveryCode: String(v.recoveryCode) } : { code: String(v.code) }
        verify.mutate(body, { onSuccess: proceed, onError: (error) => error instanceof ApiError && error.status === 401 && navigate('/login?reason=expired', { replace: true }) })
      })}
    >
      <RHFField key={name} control={form.control} name={name} label={recovery ? 'Recovery code' : '6-digit code'} required>
        {(field) =>
          recovery ? (
            <Input {...field} autoComplete="off" autoCapitalize="none" spellCheck={false} autoFocus required />
          ) : (
            <Input {...field} inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="one-time-code" autoFocus required />
          )
        }
      </RHFField>
      <FormError error={verify.error} />
      <Button type="submit" fullWidth loading={verify.isPending}>
        Verify
      </Button>
      <p className="text-center text-sm">
        <Button
          variant="link"
          onClick={() => {
            setRecovery(!recovery)
            verify.reset()
            form.reset()
          }}
        >
          {recovery ? 'Use the code from my app' : 'Use a recovery code'}
        </Button>
      </p>
    </form>
  )
}
