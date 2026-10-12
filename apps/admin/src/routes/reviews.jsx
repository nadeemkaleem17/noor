import { ReviewList } from '@/features/reviews/components/review-list'
import { useNavCounts } from '@/lib/nav-counts'
import { Component as NotFound } from './not-found'

/** `/reviews`. With reviews switched off in the store settings the server gives no count, and the page is "not found", as the menu has no entry (plan/07-admin/08-reviews.md section 1). */
export function Component() {
  const counts = useNavCounts()
  if (counts && counts.reviewsPending === undefined) return <NotFound />
  return <ReviewList />
}
