import { AlertDialog } from '@base-ui/react/alert-dialog'
import { useId, useState, type ReactElement, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { backdrop, modalSurface } from './overlay-styles'
import { Button } from './button'
import { Input } from './input'

export type ConfirmDialogProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactElement
  title: ReactNode
  body: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'danger' | 'accent'
  /** While it runs the confirm button shows loading and nothing can close the dialog. It closes when it resolves; if it throws, the dialog stays open. */
  onConfirm: () => Promise<void> | void
  /** The person must type this word before the confirm button works (destructive bulk actions). */
  confirmText?: string
}

export function ConfirmDialog({ open, onOpenChange, trigger, title, body, confirmLabel, cancelLabel, tone = 'danger', onConfirm, confirmText }: ConfirmDialogProps) {
  const { t } = useTranslation()
  const inputId = useId()
  const [inner, setInner] = useState(false)
  const [pending, setPending] = useState(false)
  const [typed, setTyped] = useState('')
  const isOpen = open ?? inner
  const setOpen = (next: boolean) => {
    setInner(next)
    if (!next) setTyped('')
    onOpenChange?.(next)
  }
  const confirm = async () => {
    setPending(true)
    try {
      await onConfirm()
      setOpen(false)
    } catch {
      // stay open; onConfirm reports its own failure (toast), as every data-layer call does
    } finally {
      setPending(false)
    }
  }
  return (
    <AlertDialog.Root
      open={isOpen}
      onOpenChange={(next, details) => {
        if (pending) return details.cancel()
        setOpen(next)
      }}
    >
      {trigger ? <AlertDialog.Trigger render={trigger} /> : null}
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={backdrop} />
        <AlertDialog.Popup
          className={`${modalSurface} fixed start-1/2 top-1/2 w-[calc(100%-2rem)] max-w-md -translate-y-1/2 rounded-card p-4 ltr:-translate-x-1/2 rtl:translate-x-1/2 transition-[opacity,scale] duration-(--dur-modal) data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0`}
        >
          <AlertDialog.Title className="font-heading text-lg">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-fg-soft">{body}</AlertDialog.Description>
          {confirmText ? (
            <div className="mt-4 flex flex-col gap-1.5">
              <label htmlFor={inputId} className="text-sm font-medium">
                {t('typeToConfirm', { text: confirmText })}
              </label>
              <Input id={inputId} value={typed} onChange={(e) => setTyped(e.currentTarget.value)} autoComplete="off" />
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <AlertDialog.Close render={<Button variant="secondary" disabled={pending} />}>{cancelLabel ?? t('cancel')}</AlertDialog.Close>
            <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={pending} disabled={confirmText !== undefined && typed !== confirmText} onClick={confirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
