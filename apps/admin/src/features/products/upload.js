// Sending a picture: ask for a slot, put the file straight into storage, tell the server it is there (plan/07-admin/03-products.md section 6, ADR-0011).
import { ApiError, maxUploadBytes, uploadTypes } from '@noor/contract'
import { api } from '@/lib/api'

/** Pictures below this long side are refused; below `goodSide` they are accepted with a warning. */
export const minSide = 800
export const goodSide = 1200
/** How often the server is asked whether a confirmed picture is ready. */
export const pollMs = 1000

/** A failure with a sentence for the person who chose the file. */
export class UploadError extends Error {}

/** @param {File} file @returns {Promise<{ width: number; height: number; }>} */
async function sizeOf(file) {
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new UploadError('This file could not be read as a picture.')
  const size = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return size
}

/**
 * @param {File} file
 * @param {(note: string) => void} [warn] - told about a picture that is allowed but smaller than it should be
 * @returns {Promise<{ id: string; src: string; alt: string; width?: number; height?: number; }>}
 */
export async function uploadImage(file, warn) {
  if (!(/** @type {readonly string[]} */ (uploadTypes)).includes(file.type)) throw new UploadError('Only JPEG, PNG, WebP and AVIF pictures can be used.')
  if (file.size > maxUploadBytes) throw new UploadError('This picture is larger than 10 MB.')
  const { width, height } = await sizeOf(file)
  const longSide = Math.max(width, height)
  if (longSide < minSide) throw new UploadError(`This picture is only ${longSide} pixels on its long side; use at least ${minSide}.`)
  if (longSide < goodSide) warn?.(`${file.name} is ${longSide} pixels on its long side; ${goodSide} or more looks better.`)

  const slot = await api('admin.media.createUpload', { body: { filename: file.name, contentType: /** @type {never} */ (file.type), bytes: file.size } })
  const put = await fetch(slot.uploadUrl, { method: 'PUT', headers: slot.headers, body: file })
  if (!put.ok) throw new UploadError('The picture could not be sent. Try again.')
  let media = await api('admin.media.confirm', { params: { id: slot.mediaId } })
  // the server checks the bytes and makes the sizes in the background: wait for it
  for (let waited = 0; media.status === 'pending' && waited < 30; waited++) {
    await new Promise((r) => setTimeout(r, pollMs))
    media = await api('admin.media.get', { params: { id: slot.mediaId } })
  }
  if (media.status === 'rejected') throw new UploadError(media.rejectReason ?? 'The server did not accept this file as a picture.')
  if (!media.image) throw new UploadError('The picture is still being processed. Try again in a moment.')
  return { id: media.id, src: media.image.src, alt: '', width: media.width, height: media.height }
}

/** The sentence under a failed file. @param {unknown} error */
export const uploadErrorText = (error) =>
  error instanceof UploadError ? error.message : error instanceof ApiError && error.code === 'rate_limited' ? 'Too many uploads. Wait a moment.' : 'The picture could not be uploaded. Try again.'
