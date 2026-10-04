import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'
import { Button } from './button'

/**
 * @typedef {object} Props
 * @property {import('react').ReactNode} title
 * @property {import('react').ReactNode} [body]
 * @property {() => void} [onRetry] - Shows a retry button.
 * @property {string} [retryLabel]
 * @property {string} [code] - Error code, shown small so a customer can quote it to support.
 * @property {string} [className]
 */

/**
 * @param {Props} props
 */
export function ErrorState({ title, body, onRetry, retryLabel, code, className }) {
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
