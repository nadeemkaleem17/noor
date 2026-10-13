// What the logs never hold (plan/11-security-auth.md section 12: no credentials, tokens or personal data): the redaction list, tried on a real logger.
import { Writable } from 'node:stream'
import pino from 'pino'
import { describe, expect, it } from 'vitest'
import { redactPaths } from '../src/platform/logger.js'

function logged(/** @type {Record<string, unknown>} */ object) {
  let out = ''
  const sink = new Writable({ write: (chunk, _e, cb) => ((out += chunk), cb()) })
  pino({ redact: { paths: redactPaths, censor: '[redacted]' } }, sink).info(object, 'x')
  return out
}

describe('log redaction', () => {
  it('hides credentials in headers, bodies and responses, and keeps what is needed to follow a request', () => {
    const line = logged({
      req: { method: 'POST', headers: { cookie: 'rb_admin=S3CR3T', authorization: 'Bearer S3CR3T', 'x-internal-key': 'S3CR3T', 'x-csrf-token': 'S3CR3T', 'x-cart-token': 'S3CR3T', 'x-request-id': 'keep-me' } },
      res: { headers: { 'set-cookie': 'rb_admin=S3CR3T' } },
      body: { password: 'S3CR3T', currentPassword: 'S3CR3T', newPassword: 'S3CR3T', recoveryCode: 'S3CR3T', phone: '03001234567', email: 'a@b.pk', otpauthUri: 'otpauth://S3CR3T' },
      err: { code: 'not_found' },
    })
    const failed = logged({ err: { type: 'Error', message: 'query failed', code: 'ER_DUP_ENTRY', sql: "insert into customers (phone) values ('03001234567')", sqlMessage: "Duplicate entry '03001234567' for key 'phone'", cause: { sql: "select '03001234567'", params: ['03001234567'] } } })
    expect(failed).not.toContain('03001234567')
    expect(failed).toContain('ER_DUP_ENTRY') // what happened stays
    expect(line).not.toContain('S3CR3T')
    expect(line).not.toContain('03001234567')
    expect(line).not.toContain('a@b.pk')
    expect(line).toContain('keep-me')
    expect(line).toContain('not_found')
  })
})
