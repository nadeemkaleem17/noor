import type { ComponentProps } from 'react'
import { cn } from '../cn'

/** A grey placeholder. Size it with `className` (`h-4 w-32`). Hidden from screen readers: the loading region carries `aria-busy`. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div aria-hidden className={cn('animate-pulse rounded-control bg-surface-2 motion-reduce:animate-none', className)} {...props} />
}
