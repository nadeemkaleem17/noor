// Email through SMTP (plan/12-integrations.md section 7). No `MAIL_URL`, no mailer: the messages are then only written to the log.
import nodemailer from 'nodemailer'

/**
 * @typedef {object} Mailer
 * @property {(m: { to: string, subject: string, text: string, html: string }) => Promise<{ providerRef?: string }>} send throws when the mail was not accepted
 */

/**
 * @param {{ MAIL_URL?: string | undefined, MAIL_FROM: string }} config
 * @param {import('nodemailer').Transporter} [transport] for tests; otherwise made from `MAIL_URL`
 * @returns {Mailer | undefined}
 */
export function createMailer(config, transport = config.MAIL_URL ? nodemailer.createTransport(config.MAIL_URL) : undefined) {
  if (!transport) return undefined
  const t = transport
  return {
    async send({ to, subject, text, html }) {
      const info = await t.sendMail({ from: config.MAIL_FROM, to, subject, text, html })
      return info.messageId ? { providerRef: String(info.messageId).slice(0, 120) } : {}
    },
  }
}
