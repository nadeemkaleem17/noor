// The two routes that make the local storage driver behave like a bucket plus an image host (development only):
//   PUT /api/v1/_dev/uploads/<key>?exp&sig   the signed upload link from storage.presignPut
//   GET /img/<key>                           generated sizes only; originals stay private
// They are not in the contract table: with S3 and imgproxy they do not exist.
import { maxUploadBytes } from '@noor/contract'
import { DomainError } from '../errors.js'
import { KEY_PATTERN } from '../storage.js'

export const DEV_UPLOAD_PREFIX = '/api/v1/_dev/uploads/'
const SIZE_KEY = /\/w\d{3,4}\.(webp|jpg)$/
const TYPES = /** @type {Record<string, string>} */ ({ webp: 'image/webp', jpg: 'image/jpeg' })

/**
 * @param {import('fastify').FastifyInstance} app
 * @param {{ storage: import('../storage.js').Storage }} deps
 */
export async function registerLocalStorageRoutes(app, { storage }) {
  await app.register(async (scope) => {
    // the body is the file itself: any content type, kept as bytes, up to the upload limit
    scope.addContentTypeParser('*', { parseAs: 'buffer', bodyLimit: maxUploadBytes }, (_req, body, done) => done(null, body))

    scope.put(`${DEV_UPLOAD_PREFIX}*`, async (req, reply) => {
      const key = /** @type {{ '*': string }} */ (req.params)['*']
      const { exp, sig } = /** @type {{ exp?: string, sig?: string }} */ (req.query)
      const body = /** @type {Buffer} */ (req.body)
      const ok = Buffer.isBuffer(body) && storage.verifyPut(key, { contentType: String(req.headers['content-type'] ?? ''), bytes: body.length, exp: Number(exp), sig: String(sig ?? '') })
      if (!ok) throw new DomainError('forbidden')
      await storage.put(key, body)
      return reply.code(200).send()
    })
  })

  app.get('/img/*', async (req, reply) => {
    const key = /** @type {{ '*': string }} */ (req.params)['*']
    if (!KEY_PATTERN.test(key) || !SIZE_KEY.test(key)) throw new DomainError('not_found')
    const data = await storage.read(key).catch(() => null)
    if (!data) throw new DomainError('not_found')
    // a size never changes once written (its key holds the media id), so it can be cached for good
    return reply
      .type(TYPES[key.slice(key.lastIndexOf('.') + 1)] ?? 'application/octet-stream')
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('cross-origin-resource-policy', 'cross-origin')
      .send(data)
  })
}
