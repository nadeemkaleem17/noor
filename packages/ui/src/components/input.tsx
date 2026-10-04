import { Input as BaseInput } from '@base-ui/react/input'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../cn'
import { controlBase, controlHeight, type ControlSize } from './control-styles'

export type InputProps = Omit<ComponentProps<typeof BaseInput>, 'size' | 'prefix'> & {
  size?: ControlSize
  invalid?: boolean
  prefix?: ReactNode
  suffix?: ReactNode
}

/** Text input. Inside a `Field` it is labelled and described automatically. For phone, email, name and address fields pass `inputMode` and `autoComplete` (DOC-04c section 3). */
export function Input({ size, invalid, prefix, suffix, className, ...props }: InputProps) {
  const aria = invalid ? { 'aria-invalid': true as const } : {}
  if (!prefix && !suffix) {
    return <BaseInput className={cn(controlBase, controlHeight(size), className)} {...aria} {...props} />
  }
  // The border and focus ring sit on the wrapper so a prefix or suffix is inside them.
  return (
    <div
      className={cn(
        controlBase,
        controlHeight(size),
        'flex items-center gap-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[[aria-invalid]]:border-danger',
        className,
      )}
    >
      {prefix ? <span className="shrink-0 text-muted">{prefix}</span> : null}
      <BaseInput className="h-full min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-muted" {...aria} {...props} />
      {suffix ? <span className="shrink-0 text-muted">{suffix}</span> : null}
    </div>
  )
}
