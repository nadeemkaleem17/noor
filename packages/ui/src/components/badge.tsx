import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

const soft: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-fg',
  accent: 'bg-accent-soft text-fg',
  success: 'bg-success-soft text-fg',
  warning: 'bg-warning-soft text-fg',
  danger: 'bg-danger-soft text-fg',
}
const solid: Record<Tone, string> = {
  neutral: 'bg-fg text-surface',
  accent: 'bg-accent text-on-accent',
  success: 'bg-success text-surface',
  warning: 'bg-warning text-surface',
  danger: 'bg-danger text-surface',
}
const outline: Record<Tone, string> = {
  neutral: 'border border-line-strong text-fg',
  accent: 'border border-accent text-accent-text',
  success: 'border border-success text-fg',
  warning: 'border border-warning text-fg',
  danger: 'border border-danger text-fg',
}
const variants = { soft, solid, outline } as const

export type BadgeProps = ComponentProps<'span'> & { tone?: Tone; variant?: keyof typeof variants }

export function Badge({ tone = 'neutral', variant = 'soft', className, ...props }: BadgeProps) {
  return <span className={cn('inline-flex items-center gap-1 rounded-control px-2 py-0.5 text-sm font-medium', variants[variant][tone], className)} {...props} />
}

// The only place a status maps to a tone and a label (DOC-04b section 6).
const statuses = {
  pending: ['order', 'neutral'],
  pending_confirmation: ['order', 'warning'],
  confirmed: ['order', 'accent'],
  dispatched: ['order', 'accent'],
  delivered: ['order', 'success'],
  cancelled: ['order', 'danger'],
  returned: ['order', 'danger'],
  unpaid: ['payment', 'neutral'],
  deposit_paid: ['payment', 'accent'],
  paid: ['payment', 'success'],
  refund_due: ['payment', 'warning'],
  partially_refunded: ['payment', 'neutral'],
  refunded: ['payment', 'neutral'],
  draft: ['product', 'neutral'],
  scheduled: ['product', 'warning'],
  active: ['product', 'success'],
  archived: ['product', 'neutral'],
  in_stock: ['stock', 'success'],
  low_stock: ['stock', 'warning'],
  sold_out: ['stock', 'danger'],
  made_to_order: ['stock', 'accent'],
  preorder: ['stock', 'accent'],
} as const satisfies Record<string, readonly [string, Tone]>

export type Status = keyof typeof statuses

/** A status is never shown by colour alone: the label is always there. Takes an order, payment (order level), product or stock status value from `@noor/contract`. */
export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const { t } = useTranslation()
  const [group, tone] = statuses[status]
  return (
    <Badge tone={tone} className={className}>
      {t(`status.${group}.${status}`)}
    </Badge>
  )
}
