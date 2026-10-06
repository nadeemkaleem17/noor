// `POST /api/v1/webhooks/<provider>` (plan/12-integrations.md section 3, ADR-0017). The signature is checked over the raw bytes, so the body stays a buffer here.
// It is outside the contract table for the same reason the storage routes are: the table describes JSON in and JSON out.
import { DomainError } from '../../platform/errors.js'

/**
 * @param {import('fastify').FastifyInstance} app
 * @param {{ payments: { receiveWebhook: (providerId: string, rawBody: Buffer, headers: Record<string, string | string[] | undefined>) => Promise<{ duplicate: boolean }> } }} deps
 */
export async function registerWebhookRoutes(app, { payments }) {
  await app.register(async (scope) => {
    scope.removeAllContentTypeParsers() // the JSON parser would hand over an object, and the signature is over the bytes
    scope.addContentTypeParser('*', { parseAs: 'buffer', bodyLimit: 256 * 1024 }, (_req, body, done) => done(null, body))
    scope.post('/api/v1/webhooks/:provider', async (req, reply) => {
      const body = req.body
      if (!Buffer.isBuffer(body)) throw new DomainError('validation_failed', { issues: [{ path: 'body', code: 'required' }] })
      const r = await payments.receiveWebhook(/** @type {{ provider: string }} */ (req.params).provider, body, req.headers)
      return reply.code(200).header('cache-control', 'no-store').send({ received: true, duplicate: r.duplicate })
    })
  })
}
