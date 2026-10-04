import { describe, expect, it } from 'vitest'
import { fillTokens, generateSecret, tokensIn } from '../../../scripts/lib/env-file.mjs'

describe('env-file helpers', () => {
  it('fills every token and reuses the same secret for the same name', () => {
    const { text, secrets } = fillTokens('A=__APP_DB_PASSWORD__\nB=mysql://u:__APP_DB_PASSWORD__@h/db\nC=__INTERNAL_API_KEY__', {})
    const [a, b, c] = text.split('\n')
    expect(a.slice(2)).toBe(secrets.APP_DB_PASSWORD)
    expect(b).toContain(`:${secrets.APP_DB_PASSWORD}@`)
    expect(c.slice(2)).toBe(secrets.INTERNAL_API_KEY)
    expect(secrets.APP_DB_PASSWORD).not.toBe(secrets.INTERNAL_API_KEY)
    expect(text).not.toMatch(/__[A-Z_]+__/)
  })

  it('keeps secrets from earlier runs, so a rerun never changes a password in use', () => {
    const first = fillTokens('X=__APP_DB_PASSWORD__', {})
    const second = fillTokens('Y=__APP_DB_PASSWORD__\nZ=__NEW_ONE__', first.secrets)
    expect(second.text.split('\n')[0]).toBe(`Y=${first.secrets.APP_DB_PASSWORD}`)
    expect(second.secrets.NEW_ONE).toBeTruthy()
  })

  it('uses base64 for encryption and tracking keys and URL-safe hex for passwords', () => {
    expect(Buffer.from(generateSecret('DATA_ENCRYPTION_KEY'), 'base64')).toHaveLength(32)
    expect(Buffer.from(generateSecret('TRACKING_KEY'), 'base64')).toHaveLength(32)
    expect(generateSecret('APP_DB_PASSWORD')).toMatch(/^[0-9a-f]{48}$/)
  })

  it('leaves text without tokens alone and lists the tokens it finds', () => {
    expect(fillTokens('PORT=3000', {}).text).toBe('PORT=3000')
    expect(tokensIn('a __X__ b __Y__ c __X__')).toEqual(['X', 'Y'])
  })
})
