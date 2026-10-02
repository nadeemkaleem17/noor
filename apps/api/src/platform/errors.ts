// DomainError and the RFC 9457 problem renderer (plan/10-api/00-conventions.md section 6).
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ResponseSerializationError } from 'fastify-type-provider-zod'
import { errorStatus, toFieldIssues, type ErrorCode, type FieldIssue, type Problem, type z } from '@noor/contract'
import type { Config } from './config'

/** Thrown by services. The HTTP status comes from the registry, not from the caller. */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    /** Extra members of the problem document (`variantId`, `available`, `cart` ...), and optionally `issues`. */
    readonly details: Record<string, unknown> = {},
    detail?: string,
  ) {
    super(detail ?? code)
    this.name = 'DomainError'
  }
}

/** Carries the original ZodError out of the validator so issues keep their field codes. */
export class RequestValidationError extends Error {
  readonly validation = []
  constructor(readonly zod: z.ZodError) {
    super('validation_failed')
  }
}

const title = (code: string) => code.charAt(0).toUpperCase() + code.slice(1).replaceAll('_', ' ')

export function toProblem(
  code: ErrorCode,
  requestId: string,
  extra: { detail?: string; issues?: FieldIssue[]; details?: Record<string, unknown> } = {},
): Problem {
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

const warnCodes: ReadonlySet<string> = new Set(['rate_limited', 'too_many_attempts', 'csrf_failed', 'invalid_transition'])

export function sendProblem(reply: FastifyReply, p: Problem) {
  return reply.code(p.status).type('application/problem+json').send(p)
}

/** One error handler for the whole app: nothing else decides what an error looks like. */
export function errorHandler(config: Config) {
  return function handle(err: FastifyError | Error, req: FastifyRequest, reply: FastifyReply) {
    const requestId = req.id

    if (err instanceof DomainError) {
      if (warnCodes.has(err.code)) req.log.warn({ code: err.code }, 'request refused')
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
  }
}
