// pino options (plan/08-backend-architecture.md section 14). Bodies and personal data are never logged.

export const redactPaths = [
  'req.headers.cookie',
  'req.headers.authorization',
  '*.password',
  '*.token',
  '*.phone',
  '*.email',
  '*.address',
  '*.landmark',
  '*.secret',
  '*.promoCode',
  // what a request or a response carries that works as a credential
  'req.headers["x-internal-key"]',
  'req.headers["x-csrf-token"]',
  'req.headers["x-cart-token"]',
  'res.headers["set-cookie"]',
  '*.currentPassword',
  '*.newPassword',
  '*.recoveryCode',
  '*.otpauthUri',
  // a database error carries the statement with its values (a phone, an address) and the duplicate value in its message
  'err.sql',
  'err.sqlMessage',
  'err.query',
  'err.params',
  'err.cause.sql',
  'err.cause.sqlMessage',
  'err.cause.query',
  'err.cause.params',
]

/**
 * @param {import('./config.js').Config} config
 * @returns {import('fastify').FastifyServerOptions['logger']}
 */
export function loggerOptions(config) {
  if (config.LOG_LEVEL === 'silent') return false
  return {
    level: config.LOG_LEVEL,
    redact: { paths: redactPaths, censor: '[redacted]' },
    // pretty output only on a developer machine
    ...(config.NODE_ENV === 'development' && config.APP_ENV === 'local' ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } } : {}),
  }
}
