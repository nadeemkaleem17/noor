import { AppLink } from '@/components/app-link'
import { AuthLayout } from '@/components/auth-layout'

// Reset links are not sent by email yet (no email provider, DOC-12 and Q-07.1-2): the owner resets a password from Staff & roles.
export function Component() {
  return (
    <AuthLayout title="Forgot your password?" footer={<AppLink to="/login">Back to sign in</AppLink>}>
      <p className="text-sm">Ask the owner to reset your password. They will give you a link to choose a new one.</p>
    </AuthLayout>
  )
}
