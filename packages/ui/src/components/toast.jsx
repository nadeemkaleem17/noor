import { Toast as BaseToast } from '@base-ui/react/toast'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'

/**
 * @typedef {'neutral' | 'success' | 'warning' | 'danger'} ToastTone
 */

/**
 * @typedef {object} ToastInput
 * @property {import('react').ReactNode} title
 * @property {import('react').ReactNode} [description]
 * @property {ToastTone} [tone]
 * @property {{ label: string; onClick: () => void; }} [action]
 * @property {number} [duration] - Milliseconds. Default 5000, danger 8000; a toast with an action stays until dismissed.
 */

const tones = /** @type {Record<ToastTone, string>} */ ({
  neutral: 'border-line-strong',
  success: 'border-success',
  warning: 'border-warning',
  danger: 'border-danger',
})

/**
 * Mount once near the app root, inside the i18n provider. At most 3 toasts show at a time.
 * @param {{ children?: import('react').ReactNode; }} props
 */
export function ToastProvider({ children }) {
  return (
    <BaseToast.Provider limit={3}>
      {children}
      <ToastList />
    </BaseToast.Provider>
  )
}

export function useToast() {
  const manager = BaseToast.useToastManager()
  return {
    /**
     * @param {ToastInput} props
     * @returns {string}
     */
    push({ title, description, tone = 'neutral', action, duration }) {
      return manager.add({
        title,
        description,
        type: tone,
        priority: tone === 'danger' ? 'high' : 'low', // high = announced assertively
        timeout: action ? 0 : (duration ?? (tone === 'danger' ? 8000 : 5000)),
        actionProps: action ? { children: action.label, onClick: action.onClick } : undefined,
      })
    },
    dismiss: manager.close,
  }
}

function ToastList() {
  const { t } = useTranslation()
  const { toasts } = BaseToast.useToastManager()
  return (
    <BaseToast.Portal>
      <BaseToast.Viewport aria-label={t('notifications')} className="fixed bottom-4 end-4 z-toast flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {toasts
          .filter((toast) => !toast.limited) // beyond the limit of 3 Base UI marks the older ones; they stay queued
          .map((toast) => (
          <BaseToast.Root
            key={toast.id}
            toast={toast}
            className={cn(
              'flex items-start gap-3 rounded-card border bg-surface p-3 text-fg shadow-pop transition-[opacity,translate] duration-(--dur-small) data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
              tones[(/** @type {ToastTone | undefined} */ (toast.type)) ?? 'neutral'],
            )}
          >
            <BaseToast.Content className="flex flex-1 flex-col gap-1">
              <BaseToast.Title className="font-medium" />
              <BaseToast.Description className="text-sm text-fg-soft" />
              {toast.actionProps ? <BaseToast.Action className="self-start text-sm font-medium text-accent-text underline" /> : null}
            </BaseToast.Content>
            <BaseToast.Close aria-label={t('dismiss')} className="flex size-7 shrink-0 items-center justify-center rounded-control text-fg-soft hover:bg-surface-2">
              <X aria-hidden className="size-4" />
            </BaseToast.Close>
          </BaseToast.Root>
        ))}
      </BaseToast.Viewport>
    </BaseToast.Portal>
  )
}
