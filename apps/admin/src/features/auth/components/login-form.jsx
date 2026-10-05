import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@noor/ui/button'
import { RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { useForm } from 'react-hook-form'
import { AppLink } from '@/components/app-link'
import { FormError } from '@/components/form-error'
import { useContinueAfterSignIn, useLogin } from '../api'
import { LoginForm } from '../schemas'

/** Email and password (plan/07-admin/01 section 5). A wrong email and a wrong password get the same answer. */
export function LoginFormView() {
  const login = useLogin()
  const proceed = useContinueAfterSignIn()
  const { control, handleSubmit } = useForm({ resolver: zodResolver(LoginForm), defaultValues: { email: '', password: '' } })
  return (
    <form noValidate className="space-y-4" onSubmit={handleSubmit((values) => login.mutate(values, { onSuccess: proceed }))}>
      <RHFField control={control} name="email" label="Email" required>
        {(field) => <Input {...field} type="email" inputMode="email" autoComplete="username" autoFocus required />}
      </RHFField>
      <RHFField control={control} name="password" label="Password" required>
        {(field) => <Input {...field} type="password" autoComplete="current-password" required />}
      </RHFField>
      <FormError error={login.error} />
      <Button type="submit" fullWidth loading={login.isPending}>
        Sign in
      </Button>
      <p className="text-center text-sm">
        <AppLink to="/forgot-password">Forgot your password?</AppLink>
      </p>
    </form>
  )
}
