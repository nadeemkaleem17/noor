// Staff, sessions, invite/reset tokens, recovery codes, login attempts (plan/09-data-model/02-auth-audit.md sections 2.1-2.5).
// No `roles` table: the five-plus-one roles are fixed in code (modules/auth/roles.js).
import { enums } from '@noor/contract'
import { sql } from 'drizzle-orm'
import { bigint, boolean, check, customType, foreignKey, index, int, json, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import { binChar, binVarchar, utc, uuid } from '../types.js'

/** `col IN ('a','b')` for a CHECK, from the contract's enum so the two cannot drift (DOC-09.0 section 5). */
export const inList = (/** @type {import('drizzle-orm').SQLWrapper} */ column, /** @type {readonly string[]} */ values) =>
  sql`${column} IN (${sql.raw(values.map((v) => `'${v.replaceAll("'", "''")}'`).join(', '))})`

/** Raw bytes column: the encrypted TOTP secret. */
const buffer = /** @type {typeof customType<{ data: Buffer }>} */ (customType)({ dataType: () => 'varbinary(255)' })

/**
 * Custom named roles (plan/17-owner-requests-2026-10.md item 11): a name for a base role plus what is added to it and taken from it. Giving someone a profile sets their role and their
 * additions and removals to the profile's, so every permission check stays what it was (role + grants - revokes); editing a profile changes everyone who has it.
 */
export const accessProfiles = mysqlTable(
  'access_profiles',
  {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 40 }).notNull(),
    summary: varchar('summary', { length: 200 }),
    baseRole: binVarchar('base_role', { length: 32 }).notNull(),
    grantedPermissions: json('granted_permissions'),
    revokedPermissions: json('revoked_permissions'),
    version: int('version').notNull().default(1),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
  },
  (t) => [uniqueIndex('access_profiles_name_uq').on(t.name), check('access_profiles_role_chk', inList(t.baseRole, enums.staffRole))],
)

export const staffUsers = mysqlTable(
  'staff_users',
  {
    id: uuid('id').primaryKey(),
    email: varchar('email', { length: 254 }).notNull(), // lower-cased
    name: varchar('name', { length: 100 }).notNull(),
    role: binVarchar('role', { length: 32 }).notNull(),
    status: binVarchar('status', { length: 32 }).notNull().default('invited'),
    /** Permissions given on top of the role, and taken off it: a list of `resource:action` (plan/17-owner-requests-2026-10.md item 11). Empty or null = the role as it is. */
    grantedPermissions: json('granted_permissions'),
    revokedPermissions: json('revoked_permissions'),
    /** The custom role this person was given; empty once their access is changed by hand. */
    profileId: uuid('profile_id'),
    passwordHash: varchar('password_hash', { length: 255 }), // Argon2id PHC string; null until the invite is accepted
    totpSecretEnc: buffer('totp_secret_enc'), // keyId | nonce | ciphertext | tag (AES-256-GCM); null = 2FA off
    totpLastStep: bigint('totp_last_step', { mode: 'number' }),
    totpEnabledAt: utc('totp_enabled_at'),
    lockCount: int('lock_count').notNull().default(0),
    lockedUntil: utc('locked_until'),
    lastLoginAt: utc('last_login_at'),
    lastSeenAt: utc('last_seen_at'),
    version: int('version').notNull().default(1),
    createdAt: utc('created_at').notNull(),
    updatedAt: utc('updated_at').notNull(),
    createdBy: uuid('created_by'),
  },
  (t) => [
    uniqueIndex('staff_users_email_uq').on(t.email),
    index('staff_users_role_idx').on(t.role, t.status),
    check('staff_users_role_chk', inList(t.role, enums.staffRole)),
    foreignKey({ name: 'staff_users_profile_fk', columns: [t.profileId], foreignColumns: [accessProfiles.id] }).onDelete('set null'),
    check('staff_users_status_chk', inList(t.status, enums.staffStatus)),
  ],
)

export const sessions = mysqlTable(
  'sessions',
  {
    idHash: binChar('id_hash', { length: 64 }).primaryKey(), // SHA-256 hex of the cookie value
    staffUserId: uuid('staff_user_id').notNull().references(() => staffUsers.id, { onDelete: 'cascade' }),
    kind: binVarchar('kind', { length: 16 }).notNull().default('full'), // pending_2fa | enrol_2fa | full
    csrfToken: binChar('csrf_token', { length: 43 }).notNull(),
    twoFactor: boolean('two_factor').notNull().default(false),
    createdAt: utc('created_at').notNull(), // absolute timeout base (14 d)
    lastSeenAt: utc('last_seen_at').notNull(), // idle timeout base (8 h), written at most once a minute
    lastAuthAt: utc('last_auth_at').notNull(), // step-up base (15 min)
    expiresAt: utc('expires_at').notNull(),
    ip: varchar('ip', { length: 45 }).notNull(),
    userAgent: varchar('user_agent', { length: 300 }).notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.staffUserId), index('sessions_expires_idx').on(t.expiresAt), check('sessions_kind_chk', inList(t.kind, ['pending_2fa', 'enrol_2fa', 'full']))],
)

export const authTokens = mysqlTable(
  'auth_tokens',
  {
    tokenHash: binChar('token_hash', { length: 64 }).primaryKey(), // SHA-256 of the token in the link
    type: binVarchar('type', { length: 32 }).notNull(), // invite | password_reset
    staffUserId: uuid('staff_user_id').notNull().references(() => staffUsers.id, { onDelete: 'cascade' }),
    expiresAt: utc('expires_at').notNull(),
    usedAt: utc('used_at'),
    createdBy: uuid('created_by'),
    createdAt: utc('created_at').notNull(),
  },
  (t) => [index('auth_tokens_user_idx').on(t.staffUserId, t.type), check('auth_tokens_type_chk', inList(t.type, enums.authTokenType))],
)

export const recoveryCodes = mysqlTable(
  'recovery_codes',
  {
    id: uuid('id').primaryKey(),
    staffUserId: uuid('staff_user_id').notNull().references(() => staffUsers.id, { onDelete: 'cascade' }),
    codeHash: varchar('code_hash', { length: 255 }).notNull(), // Argon2id
    usedAt: utc('used_at'),
    createdAt: utc('created_at').notNull(),
  },
  (t) => [index('recovery_codes_user_idx').on(t.staffUserId)],
)

export const loginAttempts = mysqlTable(
  'login_attempts',
  {
    id: uuid('id').primaryKey(),
    emailHash: binChar('email_hash', { length: 64 }).notNull(), // SHA-256 of the lower-cased email tried; unknown emails are counted without being stored
    ip: varchar('ip', { length: 45 }).notNull(),
    succeeded: boolean('succeeded').notNull(),
    createdAt: utc('created_at').notNull(),
  },
  (t) => [index('login_attempts_email_idx').on(t.emailHash, t.createdAt), index('login_attempts_ip_idx').on(t.ip, t.createdAt)],
)
