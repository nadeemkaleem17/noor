import { ApiError } from '@noor/contract'
import { ErrorState } from '@noor/ui/error-state'
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router'
import { AppLink } from './app-link'

/** A chunk that no longer exists after a deploy fails like this; reloading fetches the new build. @param {unknown} error */
const isChunkError = (error) => error instanceof Error && /dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(error.message)

/** What a route shows when it throws (plan/07-admin/01 section 6). The shell around it stays. */
export function RouteError() {
  const error = useRouteError()
  const navigate = useNavigate()
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <ErrorState title="Page not found" body={<AppLink to="/">Go to the dashboard</AppLink>} />
  }
  if (isChunkError(error)) {
    return <ErrorState title="This page could not be loaded" body="The admin was updated while you were working." retryLabel="Reload" onRetry={() => window.location.reload()} />
  }
  if (error instanceof ApiError && error.status === 403) {
    return <ErrorState title="You don't have access to this page" body="Ask an owner or manager." />
  }
  return <ErrorState title="Something went wrong" body="The page could not be shown." code={error instanceof ApiError ? error.requestId : undefined} retryLabel="Try again" onRetry={() => void navigate(0)} />
}
