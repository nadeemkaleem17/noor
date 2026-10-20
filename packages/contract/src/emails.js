// The emails a customer gets about an order, as staff manage them: a preview, a test message, the delivery log and whether a mail server is set up (plan/17-owner-requests-2026-10.md item 13).
import { z } from 'zod'
import { Page, PageQuery } from './pagination.js'
import { Id, IsoDate } from './primitives.js'
import { emailEvents } from './settings.js'
import { defineRoutes } from './routes.js'

const Event = z.enum(emailEvents)
/** What staff are editing, not yet saved: the event, and optionally their own subject and body. */
const Draft = z.strictObject({ event: Event, subject: z.string().max(120).optional(), body: z.string().max(1500).optional() })
export const RenderedEmail = z.strictObject({ subject: z.string(), body: z.string(), sample: z.boolean() })

export const EmailLogRow = z.strictObject({
  id: Id,
  template: z.string(),
  recipient: z.string(),
  status: z.enum(['queued', 'sent', 'failed', 'skipped']),
  orderNumber: z.string().optional(),
  error: z.string().optional(),
  body: z.string(),
  createdAt: IsoDate,
  sentAt: IsoDate.optional(),
})

export const emailRoutes = defineRoutes({
  'admin.emails.status': { method: 'GET', path: '/admin/emails/status', auth: 'staff', permission: 'settings:manage', response: z.strictObject({ configured: z.boolean(), from: z.string() }) },
  'admin.emails.preview': { method: 'POST', path: '/admin/emails/preview', auth: 'staff', permission: 'settings:manage', body: Draft, response: RenderedEmail },
  'admin.emails.test': {
    method: 'POST', path: '/admin/emails/test', auth: 'staff', permission: 'settings:manage', rateLimit: 'admin',
    body: Draft.extend({ to: z.email().max(254) }),
    response: z.strictObject({ status: z.enum(['sent', 'skipped', 'failed']), error: z.string().optional() }),
  },
  'admin.emails.log': {
    method: 'GET', path: '/admin/emails/log', auth: 'staff', permission: 'settings:manage',
    query: PageQuery.extend({ status: z.enum(['queued', 'sent', 'failed', 'skipped']).optional() }),
    response: Page(EmailLogRow),
  },
})
