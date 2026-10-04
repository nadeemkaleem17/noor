import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'
import { Button } from './button'

type Props = {
  title: ReactNode
  body?: ReactNode
  /** Shows a retry button. */
  onRetry?: () => void
  retryLabel?: string
  /** Error code, shown small so a customer can quote it to support. */
  code?: string
  className?: string
}

export function ErrorState({ title, body, onRetry, retryLabel, code, className }: Props) {
  const { t } = useTranslation()
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 px-4 py-12 text-center', className)}>
      <TriangleAlert aria-hidden className="size-10 text-danger" />
      <h2 className="font-heading text-lg">{title}</h2>
      {body ? <p className="max-w-prose text-fg-soft">{body}</p> : null}
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {retryLabel ?? t('retry')}
        </Button>
      ) : null}
      {code ? <p className="text-xs text-muted">{code}</p> : null}
    </div>
  )
}
