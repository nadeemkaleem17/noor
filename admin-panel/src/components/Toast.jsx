import { useCallback, useState } from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { X } from 'lucide-react'
import { ToastContext } from '../context/toastContext.js'

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, tone = 'default') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, tone, open: true }])
  }, [])

  const close = useCallback((id) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, open: false } : x)))
  }, [])

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={push}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4000}>
        {children}
        {toasts.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            className={`toast ${t.tone === 'danger' ? 'danger' : t.tone === 'success' ? 'success' : ''}`.trim()}
            open={t.open}
            onOpenChange={(open) => { if (!open) close(t.id) }}
            duration={4000}
            onAnimationEnd={() => { if (!t.open) remove(t.id) }}
          >
            <ToastPrimitive.Description>{t.message}</ToastPrimitive.Description>
            <ToastPrimitive.Close className="close-btn" aria-label="Dismiss">
              <X size={14} />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="toast-stack" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}
