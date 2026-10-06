import { generateSync } from 'otplib'
import { describe, expect, it } from 'vitest'
import { permissions } from '@noor/contract'
import { hashPassword, needsRehash, passwordProblem, verifyPassword } from '../src/modules/auth/password.js'
import { createRecoveryCodes, formatRecoveryCode, matchRecoveryCode, normalizeRecoveryCode } from '../src/modules/auth/recovery.js'
import { mayManage, permissionsOf, requiresTwoFactor, roleCan, roleList } from '../src/modules/auth/roles.js'
import { createSealer } from '../src/modules/auth/secrets.js'
import { randomToken, safeEqual, sha256Hex } from '../src/modules/auth/tokens.js'
import { newTotpSecret, totpUri, verifyTotp } from '../src/modules/auth/totp.js'

describe('two-step switch', () => {
  it('roleList shows no role as requiring it when the process has it switched off', () => {
    expect(roleList().filter((r) => r.twoFactorRequired).map((r) => r.role)).toEqual(['owner', 'manager'])
    expect(roleList(false).some((r) => r.twoFactorRequired)).toBe(false)
  })
})

describe('passwords', () => {
  it('hashes with Argon2id and verifies', async () => {
    const h = await hashPassword('correct horse battery staple')
    expect(h).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
    expect(await verifyPassword(h, 'correct horse battery staple')).toBe(true)
    expect(await verifyPassword(h, 'correct horse battery stapl3')).toBe(false)
    expect(await verifyPassword('not a hash', 'x')).toBe(false)
    expect(needsRehash(h)).toBe(false)
    expect(needsRehash('$argon2id$v=19$m=4096,t=2,p=1$c29tZXNhbHQ$abc')).toBe(true)
  })

  it('accepts a long passphrase and rejects the weak ones with a reason', () => {
    expect(passwordProblem('correct horse battery staple')).toBeNull()
    expect(passwordProblem('Tr1cky-but-fine 2026')).toBeNull()
    expect(passwordProblem('short1')).toBe('too_short')
    expect(passwordProblem('x'.repeat(129))).toBe('too_long')
    expect(passwordProblem('password1234')).toBe('common') // a common word with digits added
    expect(passwordProblem('Sunshine2026!!')).toBe('common')
    expect(passwordProblem('aaaaaaaaaaaaaa')).toBe('repetitive')
    expect(passwordProblem('qwertyuiop123')).toBe('common')
    expect(passwordProblem('ayesha.khan-lovesTea', { email: 'ayesha.khan@rubaya.pk' })).toBe('contains_name')
    expect(passwordProblem('my-rubaya-secret-1')).toBe('contains_name')
  })

  it('counts characters, not bytes, for the length rules', () => {
    expect(passwordProblem('پاکستان زندہ باد ہے')).toBeNull() // 19 characters
  })
})

describe('encryption of secrets', () => {
  const key = Buffer.alloc(32, 9).toString('base64')
  it('round-trips and uses a new nonce each time', () => {
    const s = createSealer(key)
    const a = s.seal('JBSWY3DPEHPK3PXP')
    const b = s.seal('JBSWY3DPEHPK3PXP')
    expect(a.equals(b)).toBe(false)
    expect(s.open(a)).toBe('JBSWY3DPEHPK3PXP')
    expect(a.toString('latin1')).not.toContain('JBSWY3')
  })
  it('refuses a changed value, another key, and a bad key length', () => {
    const s = createSealer(key)
    const sealed = s.seal('secret')
    const tampered = Buffer.from(sealed)
    tampered[20] = (tampered[20] ?? 0) ^ 1
    expect(() => s.open(tampered)).toThrow()
    expect(() => createSealer(Buffer.alloc(32, 1).toString('base64')).open(sealed)).toThrow()
    expect(() => s.open(Buffer.from([2, 1, 2, 3]))).toThrow(/unknown or damaged/)
    expect(() => createSealer('c2hvcnQ=')).toThrow(/32 bytes/)
  })
})

describe('tokens', () => {
  it('are 43 url-safe characters, unique, and hash to 64 hex', () => {
    const t = randomToken()
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(randomToken()).not.toBe(t)
    expect(sha256Hex(t)).toMatch(/^[0-9a-f]{64}$/)
    expect(safeEqual(t, t)).toBe(true)
    expect(safeEqual(t, `${t}x`)).toBe(false)
    expect(safeEqual('a', 'b')).toBe(false)
  })
})

describe('two-factor codes', () => {
  const secret = newTotpSecret()
  const at = Date.UTC(2026, 9, 4, 12, 0, 10)
  const codeAt = (/** @type {number} */ ms) => generateSync({ secret, epoch: Math.floor(ms / 1000) })

  it('accepts the current code and one step either side, not two', () => {
    expect(verifyTotp({ secret, code: codeAt(at), nowMs: at }).ok).toBe(true)
    expect(verifyTotp({ secret, code: codeAt(at - 30_000), nowMs: at }).ok).toBe(true)
    expect(verifyTotp({ secret, code: codeAt(at + 30_000), nowMs: at }).ok).toBe(true)
    expect(verifyTotp({ secret, code: codeAt(at - 90_000), nowMs: at }).ok).toBe(false)
    expect(verifyTotp({ secret, code: '12345', nowMs: at }).ok).toBe(false)
    expect(verifyTotp({ secret, code: 'abcdef', nowMs: at }).ok).toBe(false)
  })

  it('refuses a code for a step already used (replay)', () => {
    const first = verifyTotp({ secret, code: codeAt(at), nowMs: at })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(verifyTotp({ secret, code: codeAt(at), nowMs: at, afterStep: first.step }).ok).toBe(false)
    expect(verifyTotp({ secret, code: codeAt(at + 30_000), nowMs: at, afterStep: first.step }).ok).toBe(true)
  })

  it('builds an otpauth link for the authenticator app', () => {
    const uri = totpUri({ secret, email: 'owner@rubaya.pk' })
    expect(uri).toMatch(/^otpauth:\/\/totp\/Rubaya(%20|\+)Admin:owner%40rubaya\.pk\?/)
    expect(uri).toContain(`secret=${secret}`)
  })
})

describe('recovery codes', () => {
  it('makes 10 distinct codes from an alphabet without look-alikes, and matches a typed one once formatted differently', async () => {
    const { codes, hashes } = await createRecoveryCodes()
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    for (const c of codes) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/)
    const typed = (codes[3] ?? '').toLowerCase().replace('-', ' ')
    expect(await matchRecoveryCode(typed, hashes)).toBe(3)
    expect(await matchRecoveryCode('AAAAA-AAAAA', hashes)).toBe(-1)
    expect(await matchRecoveryCode('short', hashes)).toBe(-1)
    expect(normalizeRecoveryCode(' ab-cd ')).toBe('ABCD')
    expect(formatRecoveryCode('ABCDEFGHJK')).toBe('ABCDE-FGHJK')
  }, 30_000)
})

describe('roles', () => {
  it('owner has every permission; the others match the matrix of DOC-11 section 4.1', () => {
    expect(permissionsOf('owner').size).toBe(permissions.length)
    expect(roleCan('manager', 'staff:manage')).toBe(true)
    expect(roleCan('manager', 'customers:export')).toBe(false)
    expect(roleCan('manager', 'customers:anonymise')).toBe(false)
    expect(roleCan('catalog', 'orders:read')).toBe(false)
    expect(roleCan('fulfilment', 'orders:cancel')).toBe(true)
    expect(roleCan('fulfilment', 'orders:export')).toBe(false)
    expect(roleCan('support', 'orders:note')).toBe(true)
    expect(roleCan('support', 'orders:confirm')).toBe(false)
    expect(roleCan('viewer', 'orders:read')).toBe(true)
    expect([...permissionsOf('viewer')].every((p) => p.endsWith(':read'))).toBe(true)
  })

  it('every role has only known permissions, and two-factor is required for owner and manager', () => {
    for (const r of roleList()) expect(r.permissions.every((p) => permissions.includes(p))).toBe(true)
    expect(roleList().map((r) => [r.role, r.twoFactorRequired])).toEqual([['owner', true], ['manager', true], ['catalog', false], ['fulfilment', false], ['support', false], ['viewer', false]])
    expect(requiresTwoFactor('owner')).toBe(true)
    expect(requiresTwoFactor('viewer')).toBe(false)
  })

  it('only an owner manages an owner, and nobody grants above their own level', () => {
    expect(mayManage('owner', 'owner')).toBe(true)
    expect(mayManage('manager', 'owner')).toBe(false)
    expect(mayManage('manager', 'manager')).toBe(true)
    expect(mayManage('manager', 'viewer')).toBe(true)
    expect(mayManage('catalog', 'viewer')).toBe(false) // no staff:manage
    expect(mayManage('viewer', 'owner')).toBe(false)
  })
})

describe('cli flags', () => {
  it('reads --key value pairs and bare flags', async () => {
    const { parseFlags } = await import('../src/cli.js')
    expect(parseFlags(['--email', 'a@b.co', '--name', 'A B', '--force'])).toEqual({ email: 'a@b.co', name: 'A B', force: 'true' })
    expect(parseFlags([])).toEqual({})
  })
})
