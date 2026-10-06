// Handlers for the review routes of the contract: the customer's form (through the order's link), the product's public list, and staff moderation.

const staff = (/** @type {unknown} */ actor) => /** @type {import('./service.js').Staff} */ (actor)

/**
 * @param {ReturnType<typeof import('./service.js').createReviewsService>} s
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function reviewsHandlers(s) {
  /** @param {{ ip: string, userAgent: string }} http @param {string} requestId */
  const info = (http, requestId) => ({ ip: http.ip, userAgent: http.userAgent, requestId })

  return {
    'reviews.listForProduct': async ({ params, query }) => s.listForProduct(params.id, query),
    'reviews.getInvite': async ({ params }) => s.getInvite(params.token, params.lineId),
    'reviews.createForOrderLine': async ({ params, body }) => s.createForOrderLine(params.token, params.lineId, body),
    'reviews.createPhotoUpload': async ({ params, body }) => s.createPhotoUpload(params.token, params.lineId, body),
    'admin.reviews.list': async ({ query }) => s.list(query),
    'admin.reviews.get': async ({ params }) => s.get(params.id),
    'admin.reviews.moderate': async ({ actor, params, body, http, requestId }) => s.moderate(staff(actor), params.id, body, info(http, requestId)),
    'admin.reviews.reply': async ({ actor, params, body, http, requestId }) => s.reply(staff(actor), params.id, body.body, info(http, requestId)),
    'admin.reviews.removePhoto': async ({ actor, params, http, requestId }) => s.removePhoto(staff(actor), params.id, params.mediaId, info(http, requestId)),
    'admin.reviews.bulk': async ({ actor, body, http, requestId }) =>
      s.bulk(staff(actor), body.ids, body.action === 'approve' ? { status: 'approved' } : { status: 'rejected', reason: body.reason }, info(http, requestId)),
  }
}
