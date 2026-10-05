import { Button } from '@noor/ui/button'
import { useQueryClient } from '@tanstack/react-query'
import { redirect, useNavigate } from 'react-router'
import { AuthLayout } from '@/components/auth-layout'
import { EnrolTwoFactor } from '@/features/auth/components/enrol-two-factor'
import { useNext } from '@/features/auth/api'
import { meKey, requireMe, useLogout } from '@/lib/session'

/** Forced after sign-in for roles that need two-step sign-in: the only screens reachable are this one and sign-out. */
/** @param {{ request: Request; }} args */
export async function loader({ request }) {
  const me = await requireMe(request)
  if (me.twoFactorEnabled) throw redirect('/')
  return null
}

export function Component() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const next = useNext()
  const logout = useLogout()
  return (
    <AuthLayout
      title="Set up two-step sign-in"
      description="Your role needs a second step when you sign in."
      footer={
        <Button variant="link" onClick={() => logout.mutate()}>
          Sign out
        </Button>
      }
    >
      <EnrolTwoFactor
        onDone={() => {
          queryClient.removeQueries({ queryKey: meKey })
          void navigate(next ?? '/', { replace: true })
        }}
      />
    </AuthLayout>
  )
}
