import { Switch as BaseSwitch } from '@base-ui/react/switch'
import { cn } from '../cn'

/**
 * @typedef {Omit<import('react').ComponentProps<typeof BaseSwitch.Root>, 'children'> & { label: import('react').ReactNode; }} SwitchProps
 */

/**
 * For settings that apply immediately. Inside a form with a Save button use Checkbox.
 * @param {SwitchProps} props
 */
export function Switch({ label, className, disabled, ...props }) {
  return (
    <label className={cn('inline-flex items-center gap-3 text-fg', disabled && 'opacity-50')}>
      <BaseSwitch.Root
        disabled={disabled}
        className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-line-strong p-0.5 transition-colors duration-(--dur-micro) data-[checked]:bg-accent', className)}
        {...props}
      >
        <BaseSwitch.Thumb className="size-5 rounded-full bg-surface shadow-card transition-transform duration-(--dur-micro) data-[checked]:ltr:translate-x-5 data-[checked]:rtl:-translate-x-5" />
      </BaseSwitch.Root>
      <span className="text-(length:--control-text)">{label}</span>
    </label>
  )
}
