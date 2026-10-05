import { Spinner } from '@noor/ui/spinner'
import { useParams } from 'react-router'
import { AppLink } from '@/components/app-link'
import { AuthLayout } from '@/components/auth-layout'
import { FormError } from '@/components/form-error'
import { useAcceptInvite, useContinueAfterSignIn, useInvite } from '@/features/auth/api'
import { NewPasswordFormView } from '@/features/auth/components/new-password-form'

/** `/accept-invite/:token`: shows who the invitation is for, takes a password, then leads on to two-step set-up where the role needs it. */
export function Component() {
  const { token = '' } = useParams()
  const invite = useInvite(token)
  const accept = useAcceptInvite(token)
  const proceed = useContinueAfterSignIn()
  if (invite.isPending) {
    return (
      <AuthLayout title="Accept your invitation">
        <Spinner label="Checking the invitation" />
      </AuthLayout>
    )
  }
  if (invite.isError) {
    return (
      <AuthLayout title="Accept your invitation" footer={<AppLink to="/login">Back to sign in</AppLink>}>
        <FormError error={invite.error} />
      </AuthLayout>
    )
  }
  return (
    <AuthLayout title={`Welcome, ${invite.data.name}`} description={`Choose a password for ${invite.data.email}.`}>
      <NewPasswordFormView submitLabel="Set password and sign in" pending={accept.isPending} error={accept.error} onSubmit={(password) => accept.mutate(password, { onSuccess: proceed })} />
    </AuthLayout>
  )
}
