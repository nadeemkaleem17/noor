import { useSearchParams } from 'react-router'
import { AuthLayout } from '@/components/auth-layout'
import { LoginFormView } from '@/features/auth/components/login-form'

const notices = /** @type {Record<string, string>} */ ({
  expired: 'You were signed out. Sign in again to continue.',
  reset: 'Your password was changed. Sign in with the new one.',
})

export function Component() {
  const [params] = useSearchParams()
  const notice = notices[params.get('reason') ?? '']
  return (
    <AuthLayout title="Sign in" description="Rubaya admin">
      {notice ? (
        <p role="status" className="rounded-control bg-accent-soft px-3 py-2 text-sm text-accent-text">
          {notice}
        </p>
      ) : null}
      <LoginFormView />
    </AuthLayout>
  )
}
