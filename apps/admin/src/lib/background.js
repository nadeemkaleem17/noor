// Whether anyone is working the server's background queue (pictures, search updates, emails ...). The shell shows a warning when work is waiting for nobody, so a picture that never
// becomes ready or a search that does not find a new product is explained at once and not hunted for.
import { queryOptions, useQuery } from '@tanstack/react-query'
import { api } from './api'

export const backgroundKeys = { status: ['background', 'status'] }
export const backgroundQuery = queryOptions({
  queryKey: backgroundKeys.status,
  queryFn: ({ signal }) => api('admin.background.status', { signal }),
  refetchInterval: 30_000,
  refetchIntervalInBackground: false, // a tab nobody is looking at asks nothing
  staleTime: 10_000,
  retry: false,
})

/** The kinds of work that are waiting, as words a shop owner knows. @param {string[]} types */
export function describeWork(types) {
  /** @type {Set<string>} */
  const words = new Set()
  for (const t of types) {
    if (t.startsWith('media.')) words.add('pictures')
    else if (t.startsWith('search.')) words.add('search updates')
    else if (t.startsWith('notify.')) words.add('emails and messages')
    else if (t.startsWith('orders.') || t.startsWith('payments.')) words.add('order clean-up')
    else words.add('other background tasks')
  }
  const list = [...words]
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : (list[0] ?? 'background tasks')
}

/**
 * What the banner should say, or nothing when all is well. "down": nobody is working and something waits. "stalled": someone is, but a job has waited over a minute (it may be one long job).
 * @param {import('@noor/contract').BackgroundStatus | undefined} s
 * @returns {{ tone: 'danger' | 'warning', text: string } | undefined}
 */
export function backgroundNotice(s) {
  if (!s) return undefined
  const what = describeWork(s.waitingTypes)
  if (s.state === 'down') {
    return { tone: 'danger', text: `The background worker is not running, so ${what} are waiting (${s.waiting} task${s.waiting === 1 ? '' : 's'}, the oldest ${minutes(s.oldestOverdueSeconds)}). Start it and they will go through; locally, "pnpm dev" starts it.` }
  }
  if (s.state === 'stalled') {
    return { tone: 'warning', text: `Some background work (${what}) has been waiting for ${minutes(s.oldestOverdueSeconds)}. The worker is running; this clears by itself, or look at the failed jobs if it does not.` }
  }
  return undefined
}

/** @param {number} seconds */
const minutes = (seconds) => (seconds < 90 ? `${seconds} seconds` : `${Math.round(seconds / 60)} minutes`)

/** The status, or undefined until the first answer (or when the person may not ask). */
export const useBackgroundStatus = () => useQuery(backgroundQuery).data
