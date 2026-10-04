import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { useState, type ReactElement, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'
import { backdrop, modalSurface } from './overlay-styles'

export type DialogProps = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** The element that opens the dialog (usually a Button). Omit when `open` is controlled elsewhere. */
  trigger?: ReactElement
  title: ReactNode
  description?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  footer?: ReactNode
  /** false: Esc, the backdrop and the close button do not close it (use for a step that must be finished). Default true. */
  dismissible?: boolean
  closeLabel?: string
  children?: ReactNode
  /** Used by Drawer. */
  placement?: 'center' | 'end'
}

const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const

const centre =
  'fixed start-1/2 top-1/2 max-h-[85dvh] w-[calc(100%-2rem)] -translate-y-1/2 rounded-card ltr:-translate-x-1/2 rtl:translate-x-1/2 ' +
  'transition-[opacity,scale] duration-(--dur-modal) data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:duration-(--dur-modal-close)'

// Docked to the inline-end edge from `md` up, a bottom sheet below it. The slide direction follows the page direction.
const edge =
  'fixed w-full transition-transform duration-(--dur-modal) data-[ending-style]:duration-(--dur-modal-close) ' +
  'max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[85dvh] max-md:rounded-t-card max-md:data-[starting-style]:translate-y-full max-md:data-[ending-style]:translate-y-full ' +
  'md:inset-y-0 md:end-0 md:data-[starting-style]:ltr:translate-x-full md:data-[starting-style]:rtl:-translate-x-full md:data-[ending-style]:ltr:translate-x-full md:data-[ending-style]:rtl:-translate-x-full'

export function Dialog({ open, defaultOpen, onOpenChange, trigger, title, description, size = 'md', footer, dismissible = true, closeLabel, children, placement = 'center' }: DialogProps) {
  const { t } = useTranslation()
  const [inner, setInner] = useState(defaultOpen ?? false)
  const isOpen = open ?? inner
  return (
    <BaseDialog.Root
      open={isOpen}
      disablePointerDismissal={!dismissible}
      onOpenChange={(next, details) => {
        if (!dismissible && details.reason === 'escape-key') return details.cancel()
        setInner(next)
        onOpenChange?.(next)
      }}
    >
      {trigger ? <BaseDialog.Trigger render={trigger} /> : null}
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={backdrop} />
        <BaseDialog.Popup className={cn(modalSurface, 'flex flex-col', widths[size], placement === 'center' ? centre : edge)}>
          <div className="flex items-start gap-4 border-b border-line p-4">
            <div className="flex-1">
              <BaseDialog.Title className="font-heading text-lg">{title}</BaseDialog.Title>
              {description ? <BaseDialog.Description className="mt-1 text-sm text-muted">{description}</BaseDialog.Description> : null}
            </div>
            {dismissible ? (
              <BaseDialog.Close aria-label={closeLabel ?? t('close')} className="flex size-9 shrink-0 items-center justify-center rounded-control text-fg-soft hover:bg-surface-2">
                <X aria-hidden className="size-5" />
              </BaseDialog.Close>
            ) : null}
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line p-4">{footer}</div> : null}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}
