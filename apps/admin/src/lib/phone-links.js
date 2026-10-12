// Links that open a phone or WhatsApp from a customer's number. Staff who may not read customers get a masked number ("0300 ••••567"), which makes no link.

/** Whether a phone number is whole. @param {string} phone */
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
