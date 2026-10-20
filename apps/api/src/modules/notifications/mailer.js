// Email through SMTP (plan/12-integrations.md section 7). No `MAIL_URL`, no mailer: the messages are then only written to the log.
import nodemailer from 'nodemailer'

/**
 * @typedef {object} Mailer
 * @property {(m: { to: string, subject: string, text: string, html: string, fromName?: string | undefined, replyTo?: string | undefined }) => Promise<{ providerRef?: string }>} send throws when the mail was not accepted
 * @property {string} from the address and name mail comes from, as the server has it
 */

/**
 * @param {{ MAIL_URL?: string | undefined, MAIL_FROM: string }} config
 * @param {import('nodemailer').Transporter} [transport] for tests; otherwise made from `MAIL_URL`
 * @returns {Mailer | undefined}
 */
export function createMailer(config, transport = config.MAIL_URL ? nodemailer.createTransport(config.MAIL_URL) : undefined) {
  if (!transport) return undefined
  const t = transport
  // MAIL_FROM is "Name <address>" or just an address: staff may change the name, never the address (the mail server vouches for that one)
  const match = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(config.MAIL_FROM)
  const address = (match?.[2] ?? config.MAIL_FROM).trim()
  const name = match?.[1]?.trim() || undefined
  return {
    from: config.MAIL_FROM,
    async send({ to, subject, text, html, fromName, replyTo }) {
      const info = await t.sendMail({ from: { name: fromName || name || '', address }, to, subject, text, html, ...(replyTo ? { replyTo } : {}) })
      return info.messageId ? { providerRef: String(info.messageId).slice(0, 120) } : {}
    },
  }
}
