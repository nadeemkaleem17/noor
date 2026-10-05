// Defaults from plan/05-react-patterns.md section 10: reads retry twice (network and 5xx only), writes never.
import { ApiError } from '@noor/contract'
import { QueryCache, QueryClient } from '@tanstack/react-query'
import { sessionEvents } from './events'

/** @param {number} failures @param {unknown} error */
const retryRead = (failures, error) => failures < 2 && (!(error instanceof ApiError) || error.status >= 500)

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError(error, query) {
        // the session query is handled by the shell loader, which knows where to send the user
        if (query.queryKey[0] === 'me' || !(error instanceof ApiError)) return
        if (error.status === 401) sessionEvents.dispatchEvent(new Event('unauthenticated'))
        else if (error.code === 'forbidden') sessionEvents.dispatchEvent(new Event('forbidden'))
      },
    }),
    defaultOptions: { queries: { staleTime: 30_000, retry: retryRead, refetchOnWindowFocus: true }, mutations: { retry: 0 } },
  })
}

/** The one client of the app. Route loaders use it too, so it lives here and not in a provider. */
export const queryClient = createQueryClient()
