// The local owner account (plan/14-devops.md section 5.2). Created once; the password is shown once and never stored in clear.
import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { staffUsers } from '../db/schema/auth.js'

export const LOCAL_OWNER_EMAIL = 'owner@rubaya.test'

/**
 * @param {import('../platform/db.js').Database['db']} db
 * @param {ReturnType<typeof import('../modules/auth/index.js').createAuthService>} auth
 * @param {{ email?: string, name?: string }} [who]
 * @returns {Promise<{ id: string, email: string, password: string | null }>} `password` is set only when the account was created now
 */
export async function seedOwner(db, auth, { email = LOCAL_OWNER_EMAIL, name = 'Local Owner' } = {}) {
  const existing = (await db.select({ id: staffUsers.id }).from(staffUsers).where(eq(staffUsers.email, email)))[0]
  if (existing) return { id: existing.id, email, password: null }
  const password = randomBytes(12).toString('base64url')
  const id = await auth.createOwner({ email, name, password })
  return { id, email, password }
}
