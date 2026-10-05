import { AuthLayout } from '@/components/auth-layout'
import { AppLink } from '@/components/app-link'
import { TwoFactorFormView } from '@/features/auth/components/two-factor-form'

export function Component() {
  return (
    <AuthLayout
      title="Two-step sign-in"
      description="Enter the 6-digit code from your authenticator app."
      footer={<AppLink to="/login">Back to sign in</AppLink>}
    >
      <TwoFactorFormView />
    </AuthLayout>
  )
}
