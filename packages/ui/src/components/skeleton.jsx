import { cn } from '../cn'

/**
 * A grey placeholder. Size it with `className` (`h-4 w-32`). Hidden from screen readers: the loading region carries `aria-busy`.
 * @param {import('react').ComponentProps<'div'>} props
 */
export function Skeleton({ className, ...props }) {
  return <div aria-hidden className={cn('animate-pulse rounded-control bg-surface-2 motion-reduce:animate-none', className)} {...props} />
}
