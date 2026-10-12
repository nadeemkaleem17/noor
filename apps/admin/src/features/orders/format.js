// Small readings of an order's data for the screens: how long it has waited, and the links that open a phone or WhatsApp.

/** "20 min", "3 h", "2 d": how long ago an instant was. @param {string} iso @param {number} [now] */
export function ageText(iso, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  return hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} d`
}

/**
 * How urgent a wait is (plan/07-admin/05-orders.md section 5.1): an order that still needs a confirmation call turns warning after 2 hours and danger after 12.
 * @param {string} status @param {string} since an ISO instant @param {number} [now]
 * @returns {'neutral' | 'warning' | 'danger'}
 */
export function ageTone(status, since, now = Date.now()) {
  if (status !== 'pending_confirmation') return 'neutral'
  const hours = (now - new Date(since).getTime()) / 3_600_000
  return hours >= 12 ? 'danger' : hours >= 2 ? 'warning' : 'neutral'
}

/** Whether a phone number is whole (the API masks it for staff who may not read customers: "0300 ••••567"). @param {string} phone */
export const isWholePhone = (phone) => /^[+\d][\d\s-]*$/.test(phone)

/** The digits of a Pakistani mobile number in the international form wa.me wants, or undefined. @param {string} phone */
export function waNumber(phone) {
  if (!isWholePhone(phone)) return undefined
  const digits = phone.replace(/\D/g, '')
  const intl = digits.startsWith('92') ? digits : digits.startsWith('0') ? `92${digits.slice(1)}` : digits
  return /^92\d{10}$/.test(intl) ? intl : undefined
}

/** A wa.me link to a customer, with an optional first message; undefined when the number is masked or not a mobile number. @param {string} phone @param {string} [text] */
export const waLink = (phone, text) => {
  const n = waNumber(phone)
  return n ? `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}` : undefined
}

/** A tel: link, undefined while the number is masked. @param {string} phone */
export const telLink = (phone) => (isWholePhone(phone) ? `tel:${phone.replace(/[^\d+]/g, '')}` : undefined)
