import { routes } from '@noor/contract'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const reviewKeys = {
  all: ['reviews'],
  lists: () => [...reviewKeys.all, 'list'],
  list: (/** @type {object} */ params) => [...reviewKeys.lists(), params],
  detail: (/** @type {string} */ id) => [...reviewKeys.all, 'detail', id],
}

/** The address of the review list is parsed with the route's own query schema. */
export const reviewListSchema = routes['admin.reviews.list'].query

/** @typedef {import('@noor/contract').AdminReview} AdminReview */

export const reviewQueries = {
  /** @param {object} params parsed from the address with `reviewListSchema` */
  list: (params) => queryOptions({ queryKey: reviewKeys.list(params), queryFn: ({ signal }) => api('admin.reviews.list', { query: /** @type {never} */ (params), signal }) }),
  detail: (/** @type {string} */ id) => queryOptions({ queryKey: reviewKeys.detail(id), queryFn: ({ signal }) => api('admin.reviews.get', { params: { id }, signal }) }),
}

/** What staff do to reviews. Each puts the answer into the cache and refreshes the lists and the number beside Reviews in the menu. */
export function useReviewMutations() {
  const queryClient = useQueryClient()
  const changed = () => {
    void queryClient.invalidateQueries({ queryKey: reviewKeys.lists() })
    void queryClient.invalidateQueries({ queryKey: ['nav'] })
  }
  /** @param {AdminReview} review */
  const remember = (review) => {
    queryClient.setQueryData(reviewKeys.detail(review.id), review)
    changed()
  }
  return {
    moderate: useMutation({
      mutationFn: (/** @type {{ id: string; body: { status: 'approved' } | { status: 'rejected'; reason: string; note?: string } }} */ v) => api('admin.reviews.moderate', { params: { id: v.id }, body: /** @type {never} */ (v.body) }),
      onSuccess: remember,
    }),
    reply: useMutation({ mutationFn: (/** @type {{ id: string; body: string }} */ v) => api('admin.reviews.reply', { params: { id: v.id }, body: { body: v.body } }), onSuccess: remember }),
    removePhoto: useMutation({ mutationFn: (/** @type {{ id: string; mediaId: string }} */ v) => api('admin.reviews.removePhoto', { params: v }), onSuccess: remember }),
    bulk: useMutation({
      mutationFn: (/** @type {{ ids: string[]; action: 'approve' } | { ids: string[]; action: 'reject'; reason: string }} */ body) => api('admin.reviews.bulk', { body: /** @type {never} */ (body) }),
      onSuccess: changed,
    }),
  }
}
