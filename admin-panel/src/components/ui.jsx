import * as Dialog from '@radix-ui/react-dialog'
import * as Switch from '@radix-ui/react-switch'
import * as Tooltip from '@radix-ui/react-tooltip'
import { X, Inbox } from 'lucide-react'

// Wraps any icon-only trigger with an accessible, delayed tooltip. Use in
// place of a bare `title="…"` attribute on icon buttons — title tooltips are
// slow, inconsistent across browsers, and invisible to touch/keyboard users;
// Radix Tooltip fixes all three while keeping the same call sites (§5.1/§7.1).
export function IconButton({ label, children, ...props }) {
  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>
        <button type="button" aria-label={label} {...props}>{children}</button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" side="bottom" sideOffset={6}>
          {label}
          <Tooltip.Arrow className="tooltip-arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function Pill({ tone = 'neutral', children }) {
  return <span className={`pill ${tone}`}>{children}</span>
}

const STATUS_TONE = {
  active: 'success', in_stock: 'success', delivered: 'success', approved: 'success', confirmed: 'success',
  low_stock: 'warning', pending: 'warning', scheduled: 'info', made_to_order: 'info', draft: 'neutral',
  sold_out: 'danger', cancelled: 'danger', rejected: 'danger', expired: 'danger', disabled: 'neutral',
  archived: 'neutral', dispatched: 'info', preorder: 'info', returned: 'danger',
}
export function StatusPill({ status }) {
  const label = status.replace(/_/g, ' ')
  return <Pill tone={STATUS_TONE[status] || 'neutral'}>{label}</Pill>
}

export function Toggle({ checked, onChange, label }) {
  return (
    <Switch.Root
      className="rdx-switch"
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
    >
      <Switch.Thumb className="rdx-switch-thumb" />
    </Switch.Root>
  )
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Inbox /></div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

// Radix Dialog under the hood, but kept mount-controlled (same API as before):
// parents render `{condition && <ConfirmDialog ... />}`, so we treat mount as
// open=true and translate Radix's onOpenChange(false) — Escape, outside click,
// or the close affordance — back into the existing onCancel/onClose callback.
export function ConfirmDialog({ title, body, confirmLabel = 'Confirm', tone = 'danger', onConfirm, onCancel, children, confirmDisabled }) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onCancel() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay">
          <Dialog.Content className="modal" onOpenAutoFocus={(e) => e.preventDefault()}>
            <Dialog.Title style={{ marginBottom: 8, fontSize: 'var(--text-lg)', fontWeight: 600 }}>{title}</Dialog.Title>
            <Dialog.Description style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', marginBottom: 20 }}>{body}</Dialog.Description>
            {children && <div style={{ marginBottom: 20 }}>{children}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Dialog.Close asChild>
                <button className="btn secondary" onClick={onCancel}>Cancel</button>
              </Dialog.Close>
              <button className={`btn ${tone}`} onClick={onConfirm} disabled={confirmDisabled}>{confirmLabel}</button>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function Drawer({ title, subtitle, onClose, children, footer, width }) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay">
          <Dialog.Content className="drawer" style={width ? { width } : undefined}>
            <div className="drawer-head">
              <div>
                <Dialog.Title style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{title}</Dialog.Title>
                {subtitle
                  ? <Dialog.Description style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', marginTop: 2 }}>{subtitle}</Dialog.Description>
                  : <Dialog.Description style={{ display: 'none' }}>{title}</Dialog.Description>}
              </div>
              <Dialog.Close asChild>
                <button className="btn ghost icon" aria-label="Close"><X size={16} /></button>
              </Dialog.Close>
            </div>
            <div className="drawer-body">{children}</div>
            {footer && <div className="drawer-foot">{footer}</div>}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function SwatchDot({ swatch }) {
  if (!swatch) return null
  const color = swatch.hex ? swatch.hex[0] : '#ccc'
  return <span className="swatch-dot" style={{ background: color }} />
}