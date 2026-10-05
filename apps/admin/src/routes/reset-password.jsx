import { useNavigate, useParams } from 'react-router'
import { AuthLayout } from '@/components/auth-layout'
import { useResetPassword } from '@/features/auth/api'
import { NewPasswordFormView } from '@/features/auth/components/new-password-form'

/** `/reset-password/:token`: a new password; success signs out every session of that user and returns to sign-in. */
export function Component() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const reset = useResetPassword(token)
  return (
    <AuthLayout title="Choose a new password">
      <NewPasswordFormView
        submitLabel="Change password"
        pending={reset.isPending}
        error={reset.error}
        onSubmit={(password) => reset.mutate(password, { onSuccess: () => void navigate('/login?reason=reset', { replace: true }) })}
      />
    </AuthLayout>
  )
}
