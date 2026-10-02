// Error codes, the problem+json shape and ApiError (plan/10-api/00-conventions.md section 6).
// `code` is the only thing clients branch on. Codes are stable: never reword or reuse one.
import { z } from 'zod'

/** Every error code with the HTTP status it is returned with. The single registry for server and client. */
export const errorStatus = {
  // generic
  validation_failed: 400,
  unauthenticated: 401,
  invalid_credentials: 401,
  forbidden: 403,
  csrf_failed: 403,
  step_up_required: 403,
  two_factor_required: 403,
  not_found: 404,
  stale_write: 409,
  invalid_transition: 409,
  request_in_progress: 409,
  in_use: 409,
  payload_too_large: 413,
  idempotency_mismatch: 422,
  rate_limited: 429,
  too_many_attempts: 429,
  internal_error: 500,
  unavailable: 503,
  // domain
  insufficient_stock: 409,
  variant_unavailable: 409,
  max_per_order: 409,
  cart_full: 409,
  cart_empty: 409,
  price_changed: 409,
  cart_has_issues: 409,
  promo_not_found: 422,
  promo_not_started: 422,
  promo_expired: 422,
  promo_usage_limit: 422,
  promo_not_applicable: 422,
  promo_customer_limit: 422,
  promo_first_order_only: 422,
  promo_min_spend: 422,
  promo_invalid: 409,
  city_not_served: 422,
  shipping_method_invalid: 422,
  payment_method_not_allowed: 422,
  order_not_found: 404,
  action_not_allowed: 409,
  deposit_unpaid: 409,
  stock_below_reserved: 409,
  publish_checks_failed: 409,
  sku_taken: 409,
  handle_taken: 409,
  code_taken: 409,
  email_taken: 409,
  slug_taken: 409,
  media_not_ready: 409,
  media_rejected: 409,
  selection_changed: 409,
  last_owner: 409,
  review_already_submitted: 409,
  page_locked: 409,
  theme_contrast_failed: 422,
  no_payment_method: 422,
  no_deliverable_city: 422,
  password_too_weak: 422,
  invalid_code: 422,
  token_expired: 410,
} as const satisfies Record<string, number>

export type ErrorCode = keyof typeof errorStatus
export const errorCodes = Object.keys(errorStatus) as ErrorCode[]
export const isErrorCode = (v: unknown): v is ErrorCode => typeof v === 'string' && Object.hasOwn(errorStatus, v)

/** Codes for one field inside `validation_failed.issues[]` (DOC-10.0 section 6.3). */
export const fieldIssueCodes = [
  'required', 'too_short', 'too_long', 'too_small', 'too_big', 'invalid_format', 'unrecognized_keys',
  'name_invalid', 'phone_invalid', 'email_invalid', 'address_too_short', 'city_not_served', 'link_invalid',
  'color_invalid', 'handle_invalid', 'sku_invalid', 'code_invalid', 'not_unique',
] as const
export type FieldIssueCode = (typeof fieldIssueCodes)[number]
const isFieldIssueCode = (v: string): v is FieldIssueCode => (fieldIssueCodes as readonly string[]).includes(v)

export type FieldIssue = { path: string; code: FieldIssueCode }

/**
 * Turns a ZodError into `issues[]`. A schema can name its own code by using it as the message
 * (`z.string().regex(re, 'handle_invalid')`); otherwise the Zod issue kind is mapped.
 */
export function toFieldIssues(error: z.ZodError): FieldIssue[] {
  const out: FieldIssue[] = []
  for (const i of error.issues) {
    const path = i.path.map(String)
    if (i.code === 'unrecognized_keys') {
      for (const key of i.keys) out.push({ path: [...path, key].join('.'), code: 'unrecognized_keys' })
      continue
    }
    let code: FieldIssueCode
    if (isFieldIssueCode(i.message)) code = i.message
    else if (i.code === 'invalid_type' && /received undefined$/.test(i.message)) code = 'required'
    else if (i.code === 'too_small') code = i.origin === 'string' ? 'too_short' : 'too_small'
    else if (i.code === 'too_big') code = i.origin === 'string' ? 'too_long' : 'too_big'
    else code = 'invalid_format'
    out.push({ path: path.join('.'), code })
  }
  return out
}

/** RFC 9457 problem document as the API sends it. Unknown members are kept (they carry per-code details). */
export const Problem = z.looseObject({
  type: z.string().optional(),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string().optional(),
  requestId: z.string().optional(),
  issues: z.array(z.object({ path: z.string(), code: z.string() })).optional(),
  retryAfter: z.number().optional(),
})
export type Problem = z.infer<typeof Problem>

const codeForStatus = (status: number): ErrorCode =>
  status === 401 ? 'unauthenticated' : status === 403 ? 'forbidden' : status === 404 ? 'not_found'
  : status === 413 ? 'payload_too_large' : status === 429 ? 'rate_limited' : status === 503 ? 'unavailable'
  : status >= 400 && status < 500 ? 'validation_failed' : 'internal_error'

/** The one error class every client throws for a failed API call (replaces the two diverging ones, audit K3). */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
    readonly issues: FieldIssue[] = [],
    readonly requestId?: string,
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'ApiError'
  }

  is(code: ErrorCode): boolean {
    return this.code === code
  }

  /** From a response body (problem+json or anything else) and its HTTP status. Never throws. */
  static from(body: unknown, status: number): ApiError {
    const p = Problem.safeParse(body)
    if (!p.success) return new ApiError(codeForStatus(status), status)
    const { title, code, detail, requestId, issues } = p.data
    const known = ['type', 'title', 'status', 'code', 'detail', 'requestId', 'issues']
    const details = Object.fromEntries(Object.entries(p.data).filter(([k]) => !known.includes(k)))
    return new ApiError(
      isErrorCode(code) ? code : codeForStatus(status),
      status,
      details,
      (issues ?? []).filter((i): i is FieldIssue => isFieldIssueCode(i.code)),
      requestId,
      detail ?? title,
    )
  }
}
