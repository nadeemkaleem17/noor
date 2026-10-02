// pino options (plan/08-backend-architecture.md section 14). Bodies and personal data are never logged.
import type { FastifyServerOptions } from 'fastify'
import type { Config } from './config'

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
]

export function loggerOptions(config: Config): FastifyServerOptions['logger'] {
  if (config.LOG_LEVEL === 'silent') return false
  return {
    level: config.LOG_LEVEL,
    redact: { paths: redactPaths, censor: '[redacted]' },
    // pretty output only on a developer machine
    ...(config.NODE_ENV === 'development' && config.APP_ENV === 'local' ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } } : {}),
  }
}
