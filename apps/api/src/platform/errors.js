// DomainError and the RFC 9457 problem renderer (plan/10-api/00-conventions.md section 6).
import { ResponseSerializationError } from 'fastify-type-provider-zod'
import { errorStatus, toFieldIssues } from '@noor/contract'

/** Thrown by services. The HTTP status comes from the registry, not from the caller. */
export class DomainError extends Error {
  /**
   * @param {import('@noor/contract').ErrorCode} code
   * @param {Record<string, unknown>} [details]
   * @param {string} [detail]
   */
  constructor(
    code,
    /** Extra members of the problem document (`variantId`, `available`, `cart` ...), and optionally `issues`. */
    details = {},
    detail,
  ) {
    super(detail ?? code)
    this.code = code
    this.details = details
    this.name = 'DomainError'
  }
}

/** Carries the original ZodError out of the validator so issues keep their field codes. */
export class RequestValidationError extends Error {
  /** @type {never[]} Fastify reads this to recognise a validation error. */
  validation = []
  /**
   * @param {import('@noor/contract').z.ZodError} zod
   */
  constructor(zod) {
    super('validation_failed')
    this.zod = zod
  }
}

/**
 * @param {string} code
 */
const title = (code) => code.charAt(0).toUpperCase() + code.slice(1).replaceAll('_', ' ')

/**
 * @param {import('@noor/contract').ErrorCode} code
 * @param {string} requestId
 * @param {{ detail?: string; issues?: import('@noor/contract').FieldIssue[]; details?: Record<string, unknown>; }} [extra]
 * @returns {import('@noor/contract').Problem}
 */
export function toProblem(
  code,
  requestId,
  extra = {},
) {
  return {
    type: `https://rubaya.pk/problems/${code}`,
    title: title(code),
    status: errorStatus[code],
    code,
    requestId,
    ...(extra.detail ? { detail: extra.detail } : {}),
    ...(extra.issues ? { issues: extra.issues } : {}),
    ...extra.details,
  }
}

const warnCodes = /** @type {ReadonlySet<string>} */ (new Set(['rate_limited', 'too_many_attempts', 'csrf_failed', 'invalid_transition']))

/**
 * @param {import('fastify').FastifyReply} reply
 * @param {import('@noor/contract').Problem} p
 */
export function sendProblem(reply, p) {
  return reply.code(p.status).type('application/problem+json').send(p)
}

/**
 * One error handler for the whole app: nothing else decides what an error looks like.
 * @param {import('./config.js').Config} config
 */
export function errorHandler(config) {
  return (
    /**
     * @param {import('fastify').FastifyError | Error} err
     * @param {import('fastify').FastifyRequest} req
     * @param {import('fastify').FastifyReply} reply
     */
    function handle(err, req, reply) {
    const requestId = req.id

    if (err instanceof DomainError) {
      if (warnCodes.has(err.code)) req.log.warn({ code: err.code }, 'request refused')
      if (typeof err.details.retryAfter === 'number') void reply.header('retry-after', err.details.retryAfter)
      return sendProblem(reply, toProblem(err.code, requestId, { details: err.details, ...(err.message !== err.code ? { detail: err.message } : {}) }))
    }
    if (err instanceof RequestValidationError) {
      return sendProblem(reply, toProblem('validation_failed', requestId, { issues: toFieldIssues(err.zod) }))
    }

    const status = 'statusCode' in err && typeof err.statusCode === 'number' ? err.statusCode : 500
    if (status === 413) return sendProblem(reply, toProblem('payload_too_large', requestId))
    if (status === 429) return sendProblem(reply, toProblem('rate_limited', requestId))
    if (status >= 400 && status < 500) return sendProblem(reply, toProblem('validation_failed', requestId, { detail: err.message }))

    req.log.error({ err }, 'unhandled error')
    // detail only outside production: a serialization mismatch is a developer error (DOC-08 section 6)
    const detail = config.NODE_ENV !== 'production' && err instanceof ResponseSerializationError ? err.message : undefined
    return sendProblem(reply, toProblem('internal_error', requestId, detail ? { detail } : {}))
  })
}
