import { Input as BaseInput } from '@base-ui/react/input'
import { cn } from '../cn'
import { controlBase, controlHeight } from './control-styles'

/**
 * @typedef {Omit<import('react').ComponentProps<typeof BaseInput>, 'size' | 'prefix'> & {
 * size?: import('./control-styles').ControlSize;
 * invalid?: boolean;
 * prefix?: import('react').ReactNode;
 * suffix?: import('react').ReactNode;
 * }} InputProps
 */

/**
 * Text input. Inside a `Field` it is labelled and described automatically. For phone, email, name and address fields pass `inputMode` and `autoComplete` (DOC-04c section 3).
 * @param {InputProps} props
 */
export function Input({ size, invalid, prefix, suffix, className, ...props }) {
  const aria = invalid ? { 'aria-invalid': /** @type {const} */ (true) } : {}
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
