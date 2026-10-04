// Two-factor codes (plan/11-security-auth.md section 3.3): RFC 6238, SHA-1, 6 digits, 30 s step, one step either side, via otplib.
// The last accepted time step is stored per user, so a code cannot be used twice.
import { generateSecret, generateURI, verifySync } from 'otplib'

export const newTotpSecret = () => generateSecret()

/** The otpauth:// link an authenticator app reads from the QR code. @param {{ secret: string, email: string, issuer?: string }} args */
export const totpUri = ({ secret, email, issuer = 'Rubaya Admin' }) => generateURI({ issuer, label: email, secret })

/**
 * Checks a 6-digit code against a secret. `afterStep` is the last accepted step: that step and earlier ones are refused (replay).
 * @param {{ secret: string, code: string, afterStep?: number | null, nowMs?: number }} args
 * @returns {{ ok: true, step: number } | { ok: false }}
 */
export function verifyTotp({ secret, code, afterStep, nowMs }) {
  if (!/^\d{6}$/.test(code)) return { ok: false }
  const r = verifySync({
    secret,
    token: code,
    epochTolerance: 30,
    ...(afterStep != null ? { afterTimeStep: afterStep } : {}),
    ...(nowMs != null ? { epoch: Math.floor(nowMs / 1000) } : {}),
  })
  const step = r.valid && 'timeStep' in r ? r.timeStep : undefined
  return step === undefined ? { ok: false } : { ok: true, step }
}
