import { useTranslation } from 'react-i18next'
import { cn } from '../cn'
import { Button } from './button'

/**
 * @typedef {object} Props
 * @property {boolean} hasMore
 * @property {boolean} [loading]
 * @property {() => void} onLoadMore
 * @property {number} shown
 * @property {number} total
 * @property {string} [label]
 * @property {string} [className]
 */

/**
 * "Showing 24 of 310" and a button. Listings never load more by scrolling (DOC-06).
 * @param {Props} props
 */
export function LoadMore({ hasMore, loading, onLoadMore, shown, total, label, className }) {
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
