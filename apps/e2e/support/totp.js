import { generateSync } from 'otplib'

/** The 6-digit code an authenticator app shows now. @param {string} secret */
export const codeFor = (secret) => generateSync({ secret })
