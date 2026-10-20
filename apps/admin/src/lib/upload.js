// Sending a picture: ask for a slot, put the file straight into storage, tell the server it is there, wait for it to be made ready (plan/07-admin/03-products.md section 6, ADR-0011).
// Built so that no step can wait without end: the file goes with a progress report and an idle watchdog, a failed send is retried, the wait for the server has a budget, and the person
// can stop it at any time. When the picture never becomes ready the sentence says whether the server's background worker is the reason.
import { ApiError, maxUploadBytes, uploadTypes } from '@noor/contract'
import { api } from '@/lib/api'

/** Pictures below this long side are refused; below `goodSide` they are accepted with a warning. */
export const minSide = 800
export const goodSide = 1200
/** The waits between asking the server whether a confirmed picture is ready, in milliseconds; the sum is the budget (about 45 seconds). */
export const pollSchedule = [400, 600, 900, 1300, 1800, 2500, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000]
/** A send that makes no progress for this long is given up (and retried). */
export const idleMs = 30_000
/** Times a send is tried in all when the network or the server lets it down. */
export const sendAttempts = 3

/**
 * A failure with a sentence for the person who chose the file. `code` tells the cause apart for code that cares (and for tests).
 * @typedef {'type' | 'size' | 'small' | 'unreadable' | 'network' | 'timeout' | 'refused' | 'rejected' | 'slow' | 'worker_down' | 'busy'} UploadErrorCode
 */
export class UploadError extends Error {
  /** @param {string} message @param {UploadErrorCode} code */
  constructor(message, code) {
    super(message)
    this.name = 'UploadError'
    this.code = code
  }
}

/** @param {File} file @returns {Promise<{ width: number; height: number; }>} */
async function sizeOf(file) {
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new UploadError('This file could not be read as a picture.', 'unreadable')
  const size = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return size
}

/** Stops a flow that was cancelled: throws the same error `fetch` throws when it is aborted. @param {AbortSignal | undefined} signal @returns {void} */
function throwIfAborted(signal) {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
}

/** @param {number} ms @param {AbortSignal | undefined} signal */
const pause = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Cancelled', 'AbortError'))
    }, { once: true })
  })

/**
 * Puts the file where the slot says, reporting how much has gone. XMLHttpRequest, because `fetch` cannot report upload progress. Gives up when nothing moves for `idle` milliseconds.
 * @param {string} url @param {Record<string, string>} headers @param {File} file
 * @param {{ signal?: AbortSignal | undefined, onProgress?: ((fraction: number) => void) | undefined, idle?: number }} [opts]
 * @returns {Promise<void>}
 */
export function sendFile(url, headers, file, { signal, onProgress, idle = idleMs } = {}) {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal)
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let watchdog
    let timedOut = false
    const arm = () => {
      clearTimeout(watchdog)
      watchdog = setTimeout(() => {
        timedOut = true // abort() fires the abort event, which must report this and not a plain network failure
        xhr.abort()
      }, idle)
    }
    const done = () => clearTimeout(watchdog)
    xhr.upload.onprogress = (e) => {
      arm()
      if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () => {
      done()
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new UploadError(xhr.status >= 500 ? 'The server could not store the picture. Try again.' : 'The server did not accept the picture. Try again.', xhr.status >= 500 ? 'network' : 'refused'))
    }
    xhr.onerror = () => {
      done()
      reject(new UploadError('The picture could not be sent. Check your connection and try again.', 'network'))
    }
    xhr.onabort = () => {
      done()
      reject(
        signal?.aborted
          ? new DOMException('Cancelled', 'AbortError')
          : timedOut
            ? new UploadError('The picture stopped sending. Check your connection and try again.', 'timeout')
            : new UploadError('The picture could not be sent. Try again.', 'network'),
      )
    }
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    arm()
    xhr.send(file)
  })
}

/** Tries the send again after a network or server failure (not after a refusal or a Cancel), with a longer wait each time. @param {Parameters<typeof sendFile>} args */
async function sendWithRetry(...args) {
  const [url, headers, file, opts] = args
  for (let attempt = 1; ; attempt++) {
    try {
      return await sendFile(url, headers, file, opts)
    } catch (error) {
      const retryable = error instanceof UploadError && (error.code === 'network' || error.code === 'timeout')
      if (!retryable || attempt >= sendAttempts) throw error
      await pause(1000 * attempt, opts?.signal)
    }
  }
}

/**
 * The picture did not become ready in time: say whether the background worker is the reason.
 * @param {AbortSignal | undefined} signal @returns {Promise<UploadError>}
 */
async function whyNotReady(signal) {
  const status = await api('admin.background.status', signal ? { signal } : {}).catch(() => undefined)
  if (status && (status.state === 'down' || status.workers === 0)) {
    return new UploadError('The picture was sent, but the server\'s background worker is not running, so it cannot be made ready. Start the worker (pnpm dev does) and try again.', 'worker_down')
  }
  return new UploadError('The picture was sent but is taking too long to get ready. Try again in a moment.', 'slow')
}

/**
 * @param {File} file
 * @param {(note: string) => void} [warn] - told about a picture that is allowed but smaller than it should be
 * @param {{ minSide?: number; goodSide?: number; }} [limits] - a logo or favicon is smaller than a product picture
 * @param {{ signal: AbortSignal; onProgress: (p: { stage: 'checking' | 'sending' | 'confirming' | 'processing'; fraction?: number }) => void }} [control] - from the uploader: Cancel, and where the file is
 * @returns {Promise<{ id: string; src: string; alt: string; width?: number; height?: number; }>}
 */
export async function uploadImage(file, warn, limits = {}, control) {
  const floor = limits.minSide ?? minSide
  const good = limits.goodSide ?? goodSide
  const signal = control?.signal
  const report = (/** @type {Parameters<NonNullable<typeof control>['onProgress']>[0]} */ p) => control?.onProgress(p)
  report({ stage: 'checking' })
  if (!(/** @type {readonly string[]} */ (uploadTypes)).includes(file.type)) throw new UploadError('Only JPEG, PNG, WebP and AVIF pictures can be used.', 'type')
  if (file.size > maxUploadBytes) throw new UploadError('This picture is larger than 10 MB.', 'size')
  const { width, height } = await sizeOf(file)
  const longSide = Math.max(width, height)
  if (longSide < floor) throw new UploadError(`This picture is only ${longSide} pixels on its long side; use at least ${floor}.`, 'small')
  if (longSide < good) warn?.(`${file.name} is ${longSide} pixels on its long side; ${good} or more looks better.`)
  throwIfAborted(signal)

  const slot = await api('admin.media.createUpload', { body: { filename: file.name, contentType: /** @type {never} */ (file.type), bytes: file.size }, ...(signal ? { signal } : {}) })
  report({ stage: 'sending', fraction: 0 })
  await sendWithRetry(slot.uploadUrl, slot.headers, file, { signal, onProgress: (fraction) => report({ stage: 'sending', fraction }) })
  report({ stage: 'confirming' })
  let media = await api('admin.media.confirm', { params: { id: slot.mediaId }, ...(signal ? { signal } : {}) })
  // the server usually makes the picture ready during the confirm; otherwise it is queued, so ask now and then, with a budget
  report({ stage: 'processing' })
  for (const wait of pollSchedule) {
    if (media.status !== 'pending') break
    await pause(wait, signal)
    media = await api('admin.media.get', { params: { id: slot.mediaId }, ...(signal ? { signal } : {}) })
  }
  if (media.status === 'rejected') throw new UploadError(media.rejectReason ? `The server did not accept this picture (${media.rejectReason.replaceAll('_', ' ')}).` : 'The server did not accept this file as a picture.', 'rejected')
  if (media.status === 'pending' || !media.image) throw await whyNotReady(signal)
  return { id: media.id, src: media.image.src, alt: '', width: media.width, height: media.height }
}

/** The sentence under a failed file. @param {unknown} error */
export const uploadErrorText = (error) =>
  error instanceof UploadError
    ? error.message
    : error instanceof ApiError && error.code === 'rate_limited'
      ? 'Too many uploads. Wait a moment.'
      : error instanceof ApiError && error.code === 'unavailable'
        ? 'The server could not be reached. Check your connection and try again.'
        : 'The picture could not be uploaded. Try again.'
