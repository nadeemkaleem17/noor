import { describe, expect, it } from 'vitest'
import { scanText } from '../secrets.js'

const hits = (/** @type {string} */ text, file = 'apps/x/y.js') => scanText(file, text).map((f) => f.what)

describe('secret shapes', () => {
  it('finds keys and tokens of known services', () => {
    expect(hits('-----BEGIN PRIVATE KEY-----')).toEqual(['a private key'])
    expect(hits('const k = "AKIAABCDEFGHIJKLMNOP"')).toEqual(['an AWS access key id'])
    expect(hits(`token: ghp_${'a'.repeat(36)}`)).toEqual(['a GitHub token'])
    expect(hits('xoxb-1234567890-abcdefghij')).toEqual(['a Slack token'])
    expect(hits(`sk_live_${'A'.repeat(20)}`)).toEqual(['a live Stripe key'])
    expect(hits('Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijkl')).toEqual(['a JSON web token'])
  })

  it('finds a password in a connection address, and not a placeholder, a local one or a variable', () => {
    expect(hits('DATABASE_URL=mysql://app:Zk3xV9qLm2PaQw@db.example.com:3306/rubaya')).toEqual(['a password in a connection address'])
    expect(hits('DATABASE_URL=mysql://rubaya_app:__APP_DB_PASSWORD__@localhost:3306/rubaya')).toEqual([])
    expect(hits('mysql://x:y@h/d')).toEqual([])
    expect(hits('mysql://user:secretvalue@localhost:3307/rubaya')).toEqual([])
    expect(hits('`mysql://${user}:${pass}@${host}/db`')).toEqual([])
  })

  it('refuses the old shared admin key, wherever it comes back', () => {
    expect(hits('VITE_ADMIN_KEY=abc')).toEqual(['the old shared admin key'])
    expect(hits("headers: { 'x-admin-key': 'dev-key' }")).toEqual(['the old shared admin key'])
  })

  it('refuses an env file that is not an example', () => {
    expect(scanText('apps/api/.env', 'PORT=3000').map((f) => f.what)).toEqual(['an env file that is not an example'])
    expect(scanText('apps/api/.env.example', 'PORT=3000')).toEqual([])
    expect(scanText('apps/admin/.env.local', '')).toHaveLength(1)
  })

  it('says where', () => {
    expect(scanText('a.js', 'ok\nok\nxoxb-1234567890-abcdefghij')).toEqual([{ file: 'a.js', line: 3, what: 'a Slack token' }])
  })
})
