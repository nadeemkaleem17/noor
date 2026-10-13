// DOC-11 section 13: "Database dump inspection: no plaintext passwords, session ids, tokens or TOTP secrets."
// The secrets are made through the real flows (a password, a session, two-step set-up with its recovery codes, an invite, a password reset), then every
// text and binary column of every table is searched for each of them.
import { generateSync } from 'otplib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { now } from '../src/platform/clock.js'
import { dbAvailable } from './support/db.js'
import { browser, closeHarness, createHarness, makeStaff, PASSWORD, signedIn, t } from './support/staff.js'

describe.skipIf(!dbAvailable)('secrets at rest (MySQL, through HTTP)', () => {
  beforeAll(createHarness, 60_000)
  afterAll(closeHarness)

  /** Every column that can hold text or bytes. */
  async function textColumns() {
    const [rows] = /** @type {[{ t: string, c: string }[], unknown]} */ (
      await t.migrate.pool.query(
        `select table_name as t, column_name as c from information_schema.columns
         where table_schema = database() and data_type in ('char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext', 'binary', 'varbinary', 'tinyblob', 'blob', 'mediumblob', 'longblob', 'json')`,
      )
    )
    return rows
  }

  it('keeps passwords, session ids, set-up secrets, recovery codes, invite and reset tokens out of every table', async () => {
    const { b: owner } = await signedIn('owner')
    // a staff member with a session of their own
    const member = await makeStaff('viewer')
    const memberBrowser = browser('10.5.5.5')
    await memberBrowser.login(member.email)
    // two-step set-up of a new owner: the secret and the recovery codes
    const fresh = await makeStaff('owner')
    const enrolling = browser('10.5.5.6')
    await enrolling.call('POST', '/admin/auth/login', { body: { email: fresh.email, password: PASSWORD } })
    await enrolling.refreshCsrf()
    const begin = await enrolling.call('POST', '/admin/me/2fa/begin')
    const enable = await enrolling.call('POST', '/admin/me/2fa/enable', { body: { code: generateSync({ secret: begin.body.secret, epoch: Math.floor(now().getTime() / 1000) }) } })
    // an invite and a reset link
    const invited = await owner.call('POST', '/admin/staff', { body: { name: 'New Person', email: 'new.person@rubaya.pk', role: 'viewer' } })
    const reset = await owner.call('POST', `/admin/staff/${member.id}/password-reset`)

    /** @type {Record<string, string>} */
    const secrets = {
      'the password': PASSWORD,
      'a session id': /** @type {string} */ (memberBrowser.state.cookie),
      'the owner session id': /** @type {string} */ (owner.state.cookie),
      'the authenticator secret': begin.body.secret,
      'the invite token': invited.body.inviteLink.split('/').pop(),
      'the reset token': reset.body.resetLink.split('/').pop(),
    }
    for (const [i, code] of /** @type {string[]} */ (enable.body.recoveryCodes).entries()) secrets[`recovery code ${i + 1}`] = code
    for (const [what, value] of Object.entries(secrets)) expect(value?.length, `${what} was made`).toBeGreaterThanOrEqual(8)

    const columns = await textColumns()
    expect(columns.length).toBeGreaterThan(100) // the search covers the whole schema, not a few tables
    /** @param {string} needle */
    const where = async (needle) => {
      /** @type {string[]} */
      const places = []
      for (const { t: table, c: column } of columns) {
        const [hit] = /** @type {[{ n: number }[], unknown]} */ (await t.migrate.pool.query(`select count(*) as n from \`${table}\` where locate(?, cast(\`${column}\` as char)) > 0`, [needle]))
        if (hit[0]?.n) places.push(`${table}.${column}`)
      }
      return places
    }
    // the search can find something: an email is kept as it is
    expect(await where(member.email)).toContain('staff_users.email')

    /** @type {string[]} */
    const found = []
    for (const [what, value] of Object.entries(secrets)) {
      // recovery codes are shown with dashes and kept without; either form is a leak
      for (const needle of new Set([value, value.replaceAll('-', '')])) {
        for (const place of await where(needle)) found.push(`${what} is in ${place}`)
      }
    }
    expect(found).toEqual([])
  }, 180_000)
})
