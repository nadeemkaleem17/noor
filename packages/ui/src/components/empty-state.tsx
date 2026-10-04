import type { ReactNode } from 'react'
import { cn } from '../cn'

type Props = { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }

/** "Nothing here yet": says what is missing and offers the next step. */
export function EmptyState({ icon, title, body, action, className }: Props) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-4 py-12 text-center', className)}>
      {icon ? <div aria-hidden className="text-muted [&>svg]:size-10">{icon}</div> : null}
      <h2 className="font-heading text-lg">{title}</h2>
      {body ? <p className="max-w-prose text-fg-soft">{body}</p> : null}
      {action}
    </div>
  )
}
