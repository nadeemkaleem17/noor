import { cn } from '../cn'

/**
 * @typedef {object} Props
 * @property {import('react').ReactNode} [icon]
 * @property {import('react').ReactNode} title
 * @property {import('react').ReactNode} [body]
 * @property {import('react').ReactNode} [action]
 * @property {string} [className]
 */

/**
 * "Nothing here yet": says what is missing and offers the next step.
 * @param {Props} props
 */
export function EmptyState({ icon, title, body, action, className }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-4 py-12 text-center', className)}>
      {icon ? <div aria-hidden className="text-muted [&>svg]:size-10">{icon}</div> : null}
      <h2 className="font-heading text-lg">{title}</h2>
      {body ? <p className="max-w-prose text-fg-soft">{body}</p> : null}
      {action}
    </div>
  )
}
