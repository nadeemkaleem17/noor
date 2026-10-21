// What the shop says to people (plan/12-integrations.md section 4, plan/09-data-model/08-reviews-notifications.md section 3): one customer message per order change,
// one email to the staff for a new order. Launch path: no WhatsApp or SMS provider exists, so the customer's message is written to `notification_log` as `skipped`
// with its text, to be copied into WhatsApp by hand; email goes out through SMTP when `MAIL_URL` is set and is `skipped` the same way when it is not.
// Each message has a unique key, so a retried job never sends twice.
import { createHash } from 'node:crypto'
import { and, count, desc, eq, lt } from 'drizzle-orm'
import { formatDate, formatMoney } from '@noor/i18n'
import { orderEvents, orderLines, orders } from '../../db/schema/orders.js'
import { notificationLog } from '../../db/schema/notifications.js'
import { now } from '../../platform/clock.js'
import { uuidv7 } from '../../platform/ids.js'
import { transaction } from '../../platform/db.js'
import { DomainError } from '../../platform/errors.js'
import { record } from '../audit/index.js'
import { trackingToken } from '../orders/tracking.js'
import { defaultEmails, normalizePkMobile } from '@noor/contract'
import { fillTokens, htmlOf, render } from './templates.js'

/**
 * @typedef {import('../../platform/db.js').Database['db']} Database
 * @typedef {typeof orders.$inferSelect} OrderRow
 * @typedef {{ uniqueKey: string, template: string, channel: 'whatsapp' | 'email', audience: 'customer' | 'staff', orderId: string, recipient: string, locale: 'en' | 'ur', subject: string, body: string }} Message
 */

/** The templates an order event sends to the customer. Bank transfer gets the account details instead of the plain receipt. @param {string} event @param {OrderRow} o @param {boolean} madeToOrder */
function templatesFor(event, o, madeToOrder) {
  switch (event) {
    case 'order.placed': return [o.paymentMethod === 'bank_transfer' ? 'order.bank_details' : 'order.placed']
    case 'order.confirmed': return [madeToOrder ? 'order.confirmed_mto' : 'order.confirmed']
    case 'order.dispatched': return ['order.dispatched']
    case 'order.delivered': return ['order.delivered']
    case 'order.cancelled': return ['order.cancelled']
    case 'order.returned': return ['order.returned']
    default: return []
  }
}

/** Made-up values for a preview when the shop has no order yet. */
const sampleVars = { store: 'Rubaya', name: 'Ayesha', orderNo: 'RB-10001', total: 'Rs 7,240', link: 'https://rubaya.pk/orders/example', city: 'Lahore', items: 'Embroidered Khussa, Cotton Kurta', eta: '24 Oct to 28 Oct', leadDays: '0', courier: 'TCS', tracking: 'TCS123456', amountDue: 'Rs 7,240', account: 'Rubaya Atelier, Meezan Bank, 0123456789', method: 'cod', adminLink: '' }

/** `Rs 7,240`, with an ordinary space: the formatter's non-breaking space does not survive being pasted into a chat. @param {number} paisa */
const rupees = (paisa) => formatMoney({ amount: paisa, currency: 'PKR' }, 'en', { showDecimals: paisa % 100 !== 0, rounding: 'none' }).replace(/\u00a0/g, ' ')
const isDuplicate = (/** @type {unknown} */ e) => /** @type {{ cause?: { errno?: number }, errno?: number }} */ (e).cause?.errno === 1062 || /** @type {{ errno?: number }} */ (e).errno === 1062

/**
 * @param {object} deps
 * @param {Database} deps.db
 * @param {import('../../platform/config.js').Config} deps.config
 * @param {{ value: (key: 'store' | 'payments', x: Database) => Promise<{ value: any }> }} deps.settings
 * @param {import('./mailer.js').Mailer | undefined} deps.mailer
 * @param {import('./gateway.js').Gateway | undefined} [deps.gateway] the SMS or WhatsApp gateway; without one the phone messages are only written down
 */
export function createNotifications({ db, config, settings, mailer, gateway }) {
  /** Do the customer's phone messages go out: there is a gateway, and the shop switched it on (Settings, Emails). */
  const gatewayOn = async () => Boolean(gateway) && (await settings.value('store', db)).value.messages?.enabled === true

  /**
   * Writes the message down once and, for email with a mailer, sends it. A message already sent or skipped is left alone.
   * @param {Message} m @returns {Promise<{ status: 'sent' | 'skipped' | 'failed', fresh: boolean }>}
   */
  async function deliver(m, opts = /** @type {{ fromName?: string, replyTo?: string, gateway?: boolean }} */ ({})) {
    const [existing] = await db.select().from(notificationLog).where(eq(notificationLog.uniqueKey, m.uniqueKey))
    if (existing && (existing.status === 'sent' || existing.status === 'skipped')) return { status: existing.status, fresh: false }
    const viaGateway = m.channel === 'whatsapp' && opts.gateway === true && Boolean(gateway)
    const sends = (m.channel === 'email' && mailer) || viaGateway
    const id = existing?.id ?? uuidv7()
    if (!existing) {
      try {
        await db.insert(notificationLog).values({
          id, uniqueKey: m.uniqueKey, template: m.template, channel: m.channel, audience: m.audience, orderId: m.orderId, recipient: m.recipient, locale: m.locale, body: m.body,
          status: sends ? 'queued' : 'skipped', createdAt: now(),
        })
      } catch (e) {
        if (isDuplicate(e)) return { status: 'skipped', fresh: false } // another worker has it
        throw e
      }
      if (!sends) return { status: 'skipped', fresh: true }
    }
    const provider = viaGateway ? 'gateway' : 'smtp'
    try {
      const r = viaGateway
        ? await /** @type {import('./gateway.js').Gateway} */ (gateway).send({ to: m.recipient, text: m.body, reference: m.uniqueKey })
        : await /** @type {import('./mailer.js').Mailer} */ (mailer).send({ to: m.recipient, subject: m.subject, text: m.body, html: htmlOf(m.body), fromName: opts.fromName, replyTo: opts.replyTo })
      await db.update(notificationLog).set({ status: 'sent', provider, providerRef: r.providerRef ?? null, error: null, sentAt: now() }).where(eq(notificationLog.id, id))
      return { status: 'sent', fresh: true }
    } catch (e) {
      await db.update(notificationLog).set({ status: 'failed', provider, error: String(/** @type {Error} */ (e).message).slice(0, 300) }).where(eq(notificationLog.id, id))
      return { status: 'failed', fresh: false }
    }
  }

  /** What the order says about itself in the words of a message: never the address or the whole phone number. @param {OrderRow} o @param {{ title: string, leadMaxDays: number | null }[]} lines */
  async function varsOf(o, lines) {
    const store = await settings.value('store', db)
    const bank = (await settings.value('payments', db)).value.bankTransfer
    const base = (o.dispatchedAt ?? o.confirmedAt ?? o.placedAt).getTime()
    const day = (/** @type {number} */ days) => formatDate(new Date(base + days * 86_400_000), 'en', { day: 'numeric', month: 'short' })
    const due = o.paymentMethod === 'cod' ? Math.max(0, o.totalMinor - o.paidMinor) : 0
    const titles = lines.map((l) => l.title)
    return {
      store: String(store.value.name ?? 'Rubaya'),
      name: o.customerName.trim().split(/\s+/)[0] ?? '',
      orderNo: `${o.numberPrefix}-${o.number}`,
      total: rupees(o.totalMinor),
      link: `${config.STOREFRONT_URL}/orders/${trackingToken(config, o.id)}`,
      city: o.shipCity,
      items: titles.length > 3 ? `${titles.slice(0, 3).join(', ')} +${titles.length - 3} more` : titles.join(', '),
      eta: `${day(o.etaMinDays)} to ${day(o.etaMaxDays)}`,
      leadDays: String(Math.max(0, ...lines.map((l) => l.leadMaxDays ?? 0))),
      courier: o.courierName ?? '',
      tracking: o.trackingNumber ?? 'none',
      amountDue: due > 0 ? rupees(due) : 'none',
      account: bank ? `${bank.accountTitle}, ${bank.bank}, ${bank.accountNumber}` : '',
      method: o.paymentMethod,
      adminLink: `${config.ADMIN_ORIGIN}/orders/${o.id}`,
    }
  }

  /** The emails settings of the store, whole even for a store saved before they existed. */
  async function emailSettings() {
    const e = (await settings.value('store', db)).value.emails
    return /** @type {import('@noor/contract').z.infer<typeof import('@noor/contract').EmailSettings>} */ (e ?? defaultEmails)
  }

  /** @param {string} orderId */
  async function load(orderId) {
    const [o] = await db.select().from(orders).where(eq(orders.id, orderId))
    if (!o) return undefined
    const lines = await db.select({ title: orderLines.title, leadMaxDays: orderLines.leadMaxDays }).from(orderLines).where(eq(orderLines.orderId, orderId))
    return { o, lines, vars: await varsOf(o, lines) }
  }

  return {
    /**
     * The messages an order event calls for. Safe to run again: a message that was written down or sent is not sent twice.
     * Throws when an email could not be sent, so the job is retried with backoff.
     * @param {string} event `order.placed`, `order.confirmed` ... @param {string} orderId
     */
    async forOrder(event, orderId) {
      const found = await load(orderId)
      if (!found) return { sent: 0, skipped: 0 }
      const { o, lines, vars } = found
      const locale = /** @type {'en' | 'ur'} */ (o.locale)
      /** @type {Message[]} */
      const messages = []
      const emails = await emailSettings()
      const phoneOn = await gatewayOn()
      const say = emails.events[/** @type {keyof typeof emails.events} */ (event.replace('order.', ''))]
      for (const template of templatesFor(event, o, lines.some((l) => l.leadMaxDays != null))) {
        const base = { template, audience: /** @type {const} */ ('customer'), orderId, locale, body: render(locale, template, vars), subject: render(locale, 'email.subject', vars) }
        messages.push({ ...base, uniqueKey: `${template}:${orderId}:whatsapp`, channel: 'whatsapp', recipient: o.customerPhone })
        // the email: only while emails are on, and this event's switch is on; staff's own words replace the shop's when they wrote any
        if (o.customerEmail && emails.enabled && say?.enabled !== false) {
          messages.push({ ...base, ...(say?.body ? { body: fillTokens(say.body, vars) } : {}), ...(say?.subject ? { subject: fillTokens(say.subject, vars) } : {}), uniqueKey: `${template}:${orderId}:email`, channel: 'email', recipient: o.customerEmail })
        }
      }
      if (event === 'order.placed') {
        const emails = /** @type {string[]} */ ((await settings.value('store', db)).value.notifications?.staffEmails ?? [])
        for (const to of emails) {
          const who = createHash('sha256').update(to).digest('hex').slice(0, 10)
          messages.push({ template: 'staff.new_order', audience: 'staff', orderId, locale: 'en', channel: 'email', recipient: to, uniqueKey: `staff.new_order:${orderId}:email:${who}`, subject: render('en', 'staff.new_order.subject', vars), body: render('en', 'staff.new_order.body', vars) })
        }
      }
      let sent = 0
      let skipped = 0
      let failed = 0
      for (const m of messages) {
        const r = await deliver(m, { fromName: emails.senderName, replyTo: emails.replyTo, gateway: phoneOn })
        if (r.status === 'failed') failed += 1
        else if (r.status === 'sent') sent += 1
        else skipped += 1
        // the order's history shows what was said or skipped, once (never the text)
        if (r.fresh && m.audience === 'customer') await db.insert(orderEvents).values({ id: uuidv7(), orderId, type: 'notification', actorType: 'system', actorLabel: 'notifications', data: { template: m.template, channel: m.channel, status: r.status }, public: false, createdAt: now() })
      }
      if (failed) throw new Error(`${failed} message(s) for ${vars.orderNo} not sent`)
      return { sent, skipped }
    },

    /** The text of a template for an order, without sending anything: the staff's WhatsApp button (M4-10). @param {string} template @param {string} orderId */
    async preview(template, orderId) {
      const found = await load(orderId)
      return found ? render(/** @type {'en' | 'ur'} */ (found.o.locale), template, found.vars) : undefined
    },

    /**
     * What an email would say for an event: with the subject and body staff are typing (not yet saved), else the saved ones, else the shop's own words. Filled from the newest
     * order, or from made-up values when there is none.
     * @param {{ event: string, subject?: string | undefined, body?: string | undefined }} draft
     */
    async render(draft) {
      const emails = await emailSettings()
      const say = emails.events[/** @type {keyof typeof emails.events} */ (draft.event)]
      const [latest] = await db.select().from(orders).orderBy(desc(orders.placedAt)).limit(1)
      const found = latest ? await load(latest.id) : undefined
      const vars = found?.vars ?? sampleVars
      const locale = /** @type {'en' | 'ur'} */ (found?.o.locale ?? 'en')
      const template = `order.${draft.event}`
      const subject = draft.subject !== undefined ? draft.subject : (say?.subject ?? '')
      const body = draft.body !== undefined ? draft.body : (say?.body ?? '')
      return {
        subject: subject.trim() ? fillTokens(subject, vars) : render(locale, 'email.subject', vars),
        body: body.trim() ? fillTokens(body, vars) : render(locale, template, vars),
        sample: !found,
      }
    },

    /** Whether the server has an SMS or WhatsApp gateway at all. */
    messagesStatus: () => ({ configured: Boolean(gateway) }),

    /**
     * One text message to a phone staff type, to see that the gateway works. It goes whether or not the shop has switched phone messages on (that switch is for the customers' messages); it is
     * written to the log and to the audit log like any other.
     * @param {{ staffId: string, name: string, role: string }} actor @param {{ to: string, text?: string | undefined }} input @param {{ ip: string, userAgent: string, requestId: string }} req
     */
    async sendTestMessage(actor, input, req) {
      const to = normalizePkMobile(input.to)
      if (!to) throw new DomainError('validation_failed', { issues: [{ path: 'to', code: 'invalid_format' }] })
      const store = await settings.value('store', db)
      const text = input.text || `Test message from ${String(store.value.brand?.name ?? 'the shop')}. If you can read this, order messages reach phones.`
      const m = { uniqueKey: `test:${uuidv7()}`, template: 'test.message', channel: /** @type {const} */ ('whatsapp'), audience: /** @type {const} */ ('staff'), orderId: undefined, recipient: to, locale: /** @type {const} */ ('en'), subject: '', body: text }
      const r = await deliver(/** @type {never} */ (m), { gateway: true })
      await transaction(db, (tx) => record(tx, { actor: { type: 'staff', id: actor.staffId, label: actor.name, role: actor.role }, ip: req.ip, userAgent: req.userAgent, requestId: req.requestId, action: 'messages.test_sent', entityType: 'message', entityId: m.uniqueKey, entityLabel: `to ${to.slice(0, 6)}...`, category: 'general' }))
      const [row] = await db.select().from(notificationLog).where(eq(notificationLog.uniqueKey, m.uniqueKey))
      return { status: r.status, ...(row?.error ? { error: row.error } : {}) }
    },

    /** Whether mail can leave the server at all, and from which address. */
    status: () => ({ configured: Boolean(mailer), from: mailer?.from ?? config.MAIL_FROM }),

    /**
     * A test message to an address staff type, so they can see what the customer will get. It is written to the log like any other and to the audit log.
     * @param {{ staffId: string, name: string, role: string }} actor @param {{ event: string, to: string, subject?: string | undefined, body?: string | undefined }} draft @param {{ ip: string, userAgent: string, requestId: string }} req
     */
    async sendTest(actor, draft, req) {
      const emails = await emailSettings()
      const text = await this.render(draft)
      const m = { uniqueKey: `test:${uuidv7()}`, template: `test.${draft.event}`, channel: /** @type {const} */ ('email'), audience: /** @type {const} */ ('staff'), orderId: undefined, recipient: draft.to, locale: /** @type {const} */ ('en'), subject: `[Test] ${text.subject}`, body: text.body }
      const r = await deliver(/** @type {never} */ (m), { fromName: emails.senderName, replyTo: emails.replyTo })
      await transaction(db, (tx) => record(tx, { actor: { type: 'staff', id: actor.staffId, label: actor.name, role: actor.role }, ip: req.ip, userAgent: req.userAgent, requestId: req.requestId, action: 'emails.test_sent', entityType: 'email', entityId: draft.event, entityLabel: `${draft.event} to ${draft.to}: ${r.status}` }))
      const [row] = await db.select().from(notificationLog).where(eq(notificationLog.uniqueKey, m.uniqueKey))
      return { status: r.status, ...(row?.error ? { error: row.error } : {}) }
    },

    /** The email messages, newest first: what was sent, what failed and why, what was only written down because no mail server is set up. @param {{ page: number, size: number, status?: string }} q */
    async log(q) {
      const where = and(eq(notificationLog.channel, 'email'), q.status ? eq(notificationLog.status, q.status) : undefined)
      const [rows, total] = await Promise.all([
        db
          .select({ l: notificationLog, num: orders.number, prefix: orders.numberPrefix })
          .from(notificationLog)
          .leftJoin(orders, eq(orders.id, notificationLog.orderId))
          .where(where)
          .orderBy(desc(notificationLog.createdAt), desc(notificationLog.id))
          .limit(q.size)
          .offset((q.page - 1) * q.size),
        db.select({ n: count() }).from(notificationLog).where(where),
      ])
      return {
        items: rows.map(({ l, num, prefix }) => ({
          id: l.id, template: l.template, recipient: l.recipient, status: /** @type {'queued' | 'sent' | 'failed' | 'skipped'} */ (l.status), body: l.body, createdAt: l.createdAt.toISOString(),
          ...(num !== null && prefix ? { orderNumber: `${prefix}-${num}` } : {}), ...(l.error ? { error: l.error } : {}), ...(l.sentAt ? { sentAt: l.sentAt.toISOString() } : {}),
        })),
        total: total[0]?.n ?? 0, page: q.page, size: q.size,
      }
    },

    /** Rows older than 90 days are deleted: they hold phones, emails and the text sent. */
    async cleanup() {
      await db.delete(notificationLog).where(lt(notificationLog.createdAt, new Date(now().getTime() - 90 * 86_400_000)))
    },
  }
}
