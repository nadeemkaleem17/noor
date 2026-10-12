import { Card } from '@noor/ui/card'
import { ErrorState } from '@noor/ui/error-state'
import { Skeleton } from '@noor/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { AppLink } from '@/components/app-link'
import { ageText, ageTone } from '@/lib/age'
import { dashboardQueries } from '../api'

/** The cards of plan/07-admin/02-dashboard.md section 3: each is a link to the list that explains its number, and is left out when its number is 0 or the role may not see it. */
/** @type {{ key: keyof import('@noor/contract').z.infer<typeof import('@noor/contract').TodoCounts>; label: string; href: string; age?: string }[]} */
const cards = ([
  { key: 'toConfirm', label: 'to confirm', href: '/orders?status=pending_confirmation', age: 'pending_confirmation' },
  { key: 'toDispatch', label: 'to dispatch', href: '/orders?status=confirmed' },
  { key: 'awaitingPayment', label: 'awaiting payment', href: '/orders?status=pending' },
  { key: 'lowStock', label: 'low stock', href: '/products?stock=low' },
  { key: 'soldOut', label: 'sold out', href: '/products?stock=sold_out&status=active' },
  { key: 'reviewsPending', label: 'reviews pending', href: '/reviews?status=pending' },
  { key: 'failedJobs', label: 'failed jobs', href: '/audit' },
])

const tones = /** @type {const} */ ({ neutral: '', warning: 'border-warning', danger: 'border-danger' })

/** @param {{ now?: number }} props */
export function TodoCards({ now }) {
  const todo = useQuery(dashboardQueries.todo())
  return (
    <section aria-labelledby="todo-h" className="space-y-2">
      <h2 id="todo-h" className="text-xs font-medium uppercase tracking-wide text-muted">
        To do
      </h2>
      {todo.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : todo.isError ? (
        <ErrorState title="The to-do list could not be loaded" retryLabel="Try again" onRetry={() => void todo.refetch()} />
      ) : (
        <TodoList todo={todo.data} now={now} />
      )}
    </section>
  )
}

/** @param {{ todo: import('@noor/contract').z.infer<typeof import('@noor/contract').TodoCounts>; now?: number }} props */
function TodoList({ todo, now }) {
  const shown = cards.flatMap((c) => {
    const v = /** @type {{ count: number; oldestAt?: string } | undefined} */ (todo[c.key])
    return v && v.count > 0 ? [{ ...c, count: v.count, oldestAt: v.oldestAt }] : []
  })
  if (shown.length === 0) return <p className="rounded-card border border-line bg-surface p-4 text-sm">Nothing waiting. Nice.</p>
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {shown.map((c) => {
        const tone = c.age && c.oldestAt ? ageTone(c.age, c.oldestAt, now) : 'neutral'
        return (
          <li key={c.key}>
            <Card padding="md" className={`h-full border-2 ${tones[tone]}`}>
              <AppLink to={c.href} className="block no-underline">
                <span className="block text-2xl font-semibold tabular-nums text-fg">{c.count}</span>
                <span className="block text-sm text-fg">{c.label}</span>
                {c.oldestAt ? <span className={`block text-xs ${tone === 'neutral' ? 'text-muted' : 'text-fg'}`}>oldest {ageText(c.oldestAt, now)}</span> : null}
              </AppLink>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}
