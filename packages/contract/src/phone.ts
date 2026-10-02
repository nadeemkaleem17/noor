// Pakistani mobile numbers. Stored and sent as E.164 (+923001234567), accepted in the formats people type.
import { z } from 'zod'

/** "0300 1234567", "300-1234567", "+92 300 1234567", "0092300..." -> "+923001234567", or null (not a mobile number). */
export function normalizePkMobile(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  if (d.startsWith('0092')) d = d.slice(4)
  else if (d.startsWith('92') && d.length === 12) d = d.slice(2)
  else if (d.startsWith('0')) d = d.slice(1)
  // National mobile numbers are 10 digits starting with 3. No operator-prefix list: new ranges must not be rejected.
  return /^3\d{9}$/.test(d) ? `+92${d}` : null
}

export const PkMobile = z
  .string()
  .transform((v, ctx) => {
    const n = normalizePkMobile(v)
    if (n === null) ctx.issues.push({ code: 'custom', message: 'phone_invalid', input: v })
    return n ?? v
  })
export type PkMobile = z.output<typeof PkMobile>

/** "+923001234567" -> "0300 1234567" for display. */
export const formatPkMobileLocal = (e164: string): string => e164.replace(/^\+92(\d{3})(\d{7})$/, '0$1 $2')

/** "+923001234567" -> "0300 ••••567" (order page and masked admin views, DOC-06.6 4.1). */
export const maskPkMobile = (e164: string): string => e164.replace(/^\+92(\d{3})\d{4}(\d{3})$/, '0$1 ••••$2')
