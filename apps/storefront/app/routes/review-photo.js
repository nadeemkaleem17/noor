import { data } from 'react-router'
import { uploadReviewPhoto } from '~/lib/orders.server'

// One picture for a review (plan/06-storefront/06-orders-tracking.md section 6): the browser sends the file here and nowhere else; this puts it where the API says and answers with its id.
/** @param {import('./+types/review-photo').Route.ActionArgs} props */
export async function action({ params, request }) {
  if (request.method !== 'POST') throw new Response('Method Not Allowed', { status: 405 })
  const type = (request.headers.get('content-type') ?? '').split(';')[0] ?? ''
  const declared = Number(request.headers.get('content-length') ?? 0)
  // refused before it is read: a file above the limit is not worth the memory
  if (declared > 5 * 1024 * 1024 + 1024) {
    // the rest of the upload is thrown away, so the connection is free for the next request
    await request.body?.cancel().catch(() => undefined)
    return data({ error: 'size' }, { status: 413, headers: { Connection: 'close' } })
  }
  const bytes = await request.arrayBuffer()
  const result = await uploadReviewPhoto(params.token ?? '', params.lineId ?? '', type, bytes)
  return data(result, { status: 'error' in result ? 422 : 200, headers: { 'Cache-Control': 'private, no-store' } })
}
