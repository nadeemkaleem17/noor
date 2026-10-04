// File storage behind one small interface (plan/08-backend-architecture.md section 11). Only the `local` driver exists: a folder on this
// machine, for development. The browser PUTs to a signed link that points back at this API (routes in storage-routes.js); the S3 driver,
// whose presigned links point at the bucket, is added with deployment and must keep this interface.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile, open } from 'node:fs/promises'
import path from 'node:path'
import { now } from './clock.js'
import { uuidv7 } from './ids.js'

export const UPLOAD_TTL_MS = 10 * 60_000

/**
 * Object keys are made only from our own ids, so a key that does not fit this shape never touches the disk (no path traversal).
 * `media/<yyyy>/<mm>/<id>.<ext>` is an original, `media/<yyyy>/<mm>/<id>/w<width>.<webp|jpg>` a generated size.
 */
export const KEY_PATTERN = /^media\/\d{4}\/\d{2}\/[0-9a-f-]{36}(\.(jpg|png|webp|avif)|\/w\d{3,4}\.(webp|jpg))$/

/** @param {string} key */
const assertKey = (key) => {
  if (!KEY_PATTERN.test(key)) throw new Error(`invalid storage key: ${key}`)
}

/** The key of a new original: `media/2026/10/<uuid>.jpg`. @param {string} ext without the dot */
export function newMediaKey(ext, at = now()) {
  return `media/${at.getUTCFullYear()}/${String(at.getUTCMonth() + 1).padStart(2, '0')}/${uuidv7()}.${ext}`
}

/**
 * @param {import('./config.js').Config} config
 */
export function createStorage(config) {
  const root = path.resolve(config.LOCAL_STORAGE_DIR)
  // the signing secret is derived from the data key, so there is one secret less to configure
  const secret = createHmac('sha256', config.DATA_ENCRYPTION_KEY).update('local-storage-upload').digest()
  const file = (/** @type {string} */ key) => {
    assertKey(key)
    return path.join(root, ...key.split('/'))
  }
  const sign = (/** @type {string} */ key, /** @type {string} */ contentType, /** @type {number} */ bytes, /** @type {number} */ exp) =>
    createHmac('sha256', secret).update(`${key}\n${contentType}\n${bytes}\n${exp}`).digest('hex')

  return {
    driver: /** @type {const} */ ('local'),

    /**
     * A link the browser can PUT the file to, valid ten minutes, pinned to this type and this exact size.
     * @param {string} key @param {{ contentType: string, bytes: number }} pin
     */
    presignPut(key, { contentType, bytes }) {
      assertKey(key)
      const exp = now().getTime() + UPLOAD_TTL_MS
      const query = new URLSearchParams({ exp: String(exp), sig: sign(key, contentType, bytes, exp) })
      return {
        url: `${config.API_PUBLIC_URL}/api/v1/_dev/uploads/${key}?${query}`,
        headers: { 'content-type': contentType },
        expiresAt: new Date(exp),
      }
    },

    /**
     * Checks a PUT against its link. @param {string} key @param {{ contentType: string, bytes: number, exp: number, sig: string }} p
     * @returns {boolean}
     */
    verifyPut(key, { contentType, bytes, exp, sig }) {
      if (!KEY_PATTERN.test(key) || !Number.isFinite(exp) || exp < now().getTime()) return false
      const want = Buffer.from(sign(key, contentType, bytes, exp))
      const got = Buffer.from(sig)
      return want.length === got.length && timingSafeEqual(want, got)
    },

    /** Writes through a temporary file so a reader never sees half an object. @param {string} key @param {Buffer} data */
    async put(key, data) {
      const target = file(key)
      await mkdir(path.dirname(target), { recursive: true })
      const tmp = `${target}.${uuidv7()}.tmp`
      await writeFile(tmp, data)
      await rename(tmp, target)
    },

    /** @param {string} key */
    read: (key) => readFile(file(key)),

    /** The first `n` bytes, enough to recognise a file type without reading all of it. @param {string} key @param {number} n */
    async readHead(key, n) {
      const handle = await open(file(key), 'r')
      try {
        const buf = Buffer.alloc(n)
        const { bytesRead } = await handle.read(buf, 0, n, 0)
        return buf.subarray(0, bytesRead)
      } finally {
        await handle.close()
      }
    },

    /** Size in bytes, or null when there is no such object. @param {string} key */
    async size(key) {
      try {
        return (await stat(file(key))).size
      } catch {
        return null
      }
    },

    /** Removing something that is already gone is not an error. @param {string} key */
    remove: (key) => rm(file(key), { force: true }),

    /** Removes an original and the folder of its generated sizes. @param {string} original */
    async removeWithSizes(original) {
      await rm(file(original), { force: true })
      await rm(path.join(root, ...original.replace(/\.[a-z]+$/, '').split('/')), { recursive: true, force: true })
    },
  }
}

/** @typedef {ReturnType<typeof createStorage>} Storage */
