import { ErrorState } from '@noor/ui/error-state'
import { AppLink } from '@/components/app-link'

export function Component() {
  return <ErrorState title="Page not found" body={<AppLink to="/">Go to the dashboard</AppLink>} />
}
