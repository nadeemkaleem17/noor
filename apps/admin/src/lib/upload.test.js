// The picture upload flow (plan/07-admin/03-products.md section 6): every step ends, reports where it is, can be cancelled, and says what went wrong.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({ api: vi.fn() }))
const { api } = await import('@/lib/api')
const { pollSchedule, sendAttempts, sendFile, uploadErrorText, uploadImage } = await import('./upload')

const mocked = /** @type {import('vitest').Mock} */ (/** @type {unknown} */ (api))
const png = (size = 1000) => new File([new Uint8Array(size)], 'a.png', { type: 'image/png' })
const slot = { mediaId: 'm1', uploadUrl: 'http://api/upload/m1', headers: { 'content-type': 'image/png' } }
const ready = { id: 'm1', status: 'ready', width: 1600, height: 1200, image: { src: '/img/m1.webp' } }

/** What the next XMLHttpRequest does: a function that gets the request and drives it. @type {Array<(x: FakeXhr) => void>} */
let script = []
class FakeXhr {
  upload = /** @type {{ onprogress: ((e: object) => void) | null }} */ ({ onprogress: null })
  onload = /** @type {(() => void) | null} */ (null)
  onerror = /** @type {(() => void) | null} */ (null)
  onabort = /** @type {(() => void) | null} */ (null)
  status = 0
  open() {}
  setRequestHeader() {}
  send() {
    const step = script.shift()
    if (step) queueMicrotask(() => step(this))
  }
  abort() {
    this.onabort?.()
  }
}
/** @param {FakeXhr} x */
const succeed = (x) => {
  x.upload.onprogress?.({ lengthComputable: true, loaded: 500, total: 1000 })
  x.upload.onprogress?.({ lengthComputable: true, loaded: 1000, total: 1000 })
  x.status = 200
  x.onload?.()
}
/** @param {FakeXhr} x */
const fail = (x) => x.onerror?.()

beforeEach(() => {
  vi.useFakeTimers()
  script = []
  mocked.mockReset()
  vi.stubGlobal('XMLHttpRequest', FakeXhr)
  vi.stubGlobal('createImageBitmap', async () => ({ width: 1600, height: 1200, close() {} }))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Runs the flow while advancing the fake clock, so waits do not stall the test. @template T @param {Promise<T>} p */
async function settle(p) {
  const guarded = p.then((v) => ({ v }), (e) => ({ e }))
  for (let i = 0; i < 200; i++) {
    await vi.advanceTimersByTimeAsync(1000)
    const r = await Promise.race([guarded, Promise.resolve(undefined)])
    if (r) return r
  }
  throw new Error('the flow did not end')
}

describe('uploadImage', () => {
  it('sends the file with progress, confirms, and returns the picture; the stages come in order', async () => {
    script = [succeed]
    mocked.mockResolvedValueOnce(slot).mockResolvedValueOnce(ready)
    const seen = /** @type {string[]} */ ([])
    const r = await settle(uploadImage(png(), undefined, {}, { signal: new AbortController().signal, onProgress: (p) => seen.push(`${p.stage}${p.fraction === undefined ? '' : `:${p.fraction}`}`) }))
    expect(r).toEqual({ v: { id: 'm1', src: '/img/m1.webp', alt: '', width: 1600, height: 1200 } })
    expect(seen).toEqual(['checking', 'sending:0', 'sending:0.5', 'sending:1', 'confirming', 'processing'])
    expect(mocked.mock.calls.map((c) => c[0])).toEqual(['admin.media.createUpload', 'admin.media.confirm']) // ready at once: no polling
  })

  it('retries a send that failed on the network, then succeeds', async () => {
    script = [fail, succeed]
    mocked.mockResolvedValueOnce(slot).mockResolvedValueOnce(ready)
    const r = await settle(uploadImage(png()))
    expect(r).toMatchObject({ v: { id: 'm1' } })
    expect(script).toHaveLength(0)
  })

  it('gives up after the last attempt with a sentence about the connection', async () => {
    script = Array.from({ length: sendAttempts }, () => fail)
    mocked.mockResolvedValueOnce(slot)
    const r = await settle(uploadImage(png()))
    expect(r).toMatchObject({ e: expect.objectContaining({ code: 'network' }) })
    expect(uploadErrorText(/** @type {{ e: unknown }} */ (r).e)).toContain('connection')
  })

  it('does not retry a refusal by the server', async () => {
    script = [(x) => {
      x.status = 403
      x.onload?.()
    }]
    mocked.mockResolvedValueOnce(slot)
    const r = await settle(uploadImage(png()))
    expect(r).toMatchObject({ e: expect.objectContaining({ code: 'refused' }) })
    expect(script).toHaveLength(0)
  })

  it('stops a send that makes no progress, instead of waiting for ever', async () => {
    script = Array.from({ length: sendAttempts }, () => () => {}) // the request just sits there
    mocked.mockResolvedValueOnce(slot)
    const r = await settle(uploadImage(png()))
    expect(r).toMatchObject({ e: expect.objectContaining({ code: 'timeout' }) })
  })

  it('waits for a picture that is queued, asking on a schedule, and returns it when it is ready', async () => {
    script = [succeed]
    mocked.mockResolvedValueOnce(slot).mockResolvedValueOnce({ id: 'm1', status: 'pending' }).mockResolvedValueOnce({ id: 'm1', status: 'pending' }).mockResolvedValueOnce(ready)
    const r = await settle(uploadImage(png()))
    expect(r).toMatchObject({ v: { id: 'm1' } })
    expect(mocked.mock.calls.map((c) => c[0])).toEqual(['admin.media.createUpload', 'admin.media.confirm', 'admin.media.get', 'admin.media.get'])
  })

  it('a picture that never gets ready ends with a sentence: the worker is off, or it is only slow', async () => {
    for (const [status, code, mentions] of /** @type {const} */ ([[{ state: 'down', workers: 0 }, 'worker_down', 'background worker'], [{ state: 'ok', workers: 1 }, 'slow', 'taking too long']])) {
      script = [succeed]
      mocked.mockReset()
      mocked.mockImplementation(async (/** @type {string} */ key) => (key === 'admin.media.createUpload' ? slot : key === 'admin.background.status' ? status : { id: 'm1', status: 'pending' }))
      const r = await settle(uploadImage(png()))
      expect(r).toMatchObject({ e: expect.objectContaining({ code }) })
      expect(uploadErrorText(/** @type {{ e: unknown }} */ (r).e)).toContain(mentions)
      expect(mocked.mock.calls.filter((c) => c[0] === 'admin.media.get')).toHaveLength(pollSchedule.length)
    }
  })

  it('a refused picture says why in words', async () => {
    script = [succeed]
    mocked.mockResolvedValueOnce(slot).mockResolvedValueOnce({ id: 'm1', status: 'rejected', rejectReason: 'not_an_image' })
    const r = await settle(uploadImage(png()))
    expect(uploadErrorText(/** @type {{ e: unknown }} */ (r).e)).toContain('not an image')
  })

  it('Cancel stops it at once: the send is aborted and nothing more is asked of the server', async () => {
    const control = new AbortController()
    script = [() => control.abort()] // the person presses Cancel while the file is on its way
    mocked.mockResolvedValueOnce(slot)
    const r = await settle(uploadImage(png(), undefined, {}, { signal: control.signal, onProgress: () => {} }))
    expect(r).toMatchObject({ e: expect.objectContaining({ name: 'AbortError' }) })
    expect(mocked.mock.calls.map((c) => c[0])).toEqual(['admin.media.createUpload'])
  })

  it('refuses a wrong type, a too large file, an unreadable one and a too small one before sending anything', async () => {
    const wrong = await settle(uploadImage(new File(['x'], 'a.gif', { type: 'image/gif' })))
    expect(wrong).toMatchObject({ e: expect.objectContaining({ code: 'type' }) })
    const huge = await settle(uploadImage(png(11 * 1024 * 1024)))
    expect(huge).toMatchObject({ e: expect.objectContaining({ code: 'size' }) })
    vi.stubGlobal('createImageBitmap', async () => null)
    expect(await settle(uploadImage(png()))).toMatchObject({ e: expect.objectContaining({ code: 'unreadable' }) })
    vi.stubGlobal('createImageBitmap', async () => ({ width: 300, height: 200, close() {} }))
    expect(await settle(uploadImage(png()))).toMatchObject({ e: expect.objectContaining({ code: 'small' }) })
    expect(mocked).not.toHaveBeenCalledWith('admin.media.confirm', expect.anything())
  })
})

describe('sendFile', () => {
  it('reports the fraction sent and resolves on a 2xx', async () => {
    script = [succeed]
    const fractions = /** @type {number[]} */ ([])
    await settle(sendFile('http://x', {}, png(), { onProgress: (f) => fractions.push(f) }))
    expect(fractions).toEqual([0.5, 1])
  })
  it('is an UploadError that tells a server fault from a refusal', async () => {
    script = [(x) => {
      x.status = 503
      x.onload?.()
    }]
    const r = await settle(sendFile('http://x', {}, png()))
    expect(/** @type {{ e: import("./upload").UploadError }} */ (r).e.code).toBe('network')
  })
})
