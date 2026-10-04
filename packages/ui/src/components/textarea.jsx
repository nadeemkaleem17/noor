import { Field as BaseField } from '@base-ui/react/field'
import { cn } from '../cn'
import { controlBase } from './control-styles'

/**
 * @typedef {import('react').ComponentProps<'textarea'> & { invalid?: boolean; autoGrow?: boolean; }} TextareaProps
 */

/**
 * Multi-line text. `autoGrow` sizes it to its content with the platform's `field-sizing`.
 * @param {TextareaProps} props
 */
export function Textarea({ invalid, autoGrow, className, rows = 3, ...props }) {
  return (
    <BaseField.Control
      render={
        <textarea
          rows={rows}
          aria-invalid={invalid || undefined}
          className={cn(controlBase, 'min-h-20 py-2 text-(length:--control-text)', autoGrow && '[field-sizing:content]', className)}
          {...props}
        />
      }
    />
  )
}
