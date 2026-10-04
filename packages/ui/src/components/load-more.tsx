import { useTranslation } from 'react-i18next'
import { cn } from '../cn'
import { Button } from './button'

type Props = {
  hasMore: boolean
  loading?: boolean
  onLoadMore: () => void
  shown: number
  total: number
  label?: string
  className?: string
}

/** "Showing 24 of 310" and a button. Listings never load more by scrolling (DOC-06). */
export function LoadMore({ hasMore, loading, onLoadMore, shown, total, label, className }: Props) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <p role="status" className="text-sm text-muted">
        {t('showing', { shown, total })}
      </p>
      {hasMore ? (
        <Button variant="secondary" loading={loading} onClick={onLoadMore}>
          {label ?? t('loadMore')}
        </Button>
      ) : null}
    </div>
  )
}
