// Encryption of secrets stored in the database (TOTP secrets): AES-256-GCM with a random nonce per value (plan/11-security-auth.md 3.3).
// Stored form: keyId (1 byte) | nonce (12) | ciphertext | tag (16). The key id lets a new key be introduced without breaking old rows.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const KEY_ID = 1

/** @param {string} base64Key 32 bytes in base64 (DATA_ENCRYPTION_KEY) */
export function createSealer(base64Key) {
  const key = Buffer.from(base64Key, 'base64')
  if (key.length !== 32) throw new Error('the encryption key must be 32 bytes')
  return {
    /** @param {string} plain @returns {Buffer} */
    seal(plain) {
      const nonce = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', key, nonce)
      const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
      return Buffer.concat([Buffer.from([KEY_ID]), nonce, body, cipher.getAuthTag()])
    },
    /** Throws if the value was changed or was sealed with another key. @param {Buffer} sealed @returns {string} */
    open(sealed) {
      if (sealed.length < 1 + 12 + 16 || sealed[0] !== KEY_ID) throw new Error('unknown or damaged sealed value')
      const decipher = createDecipheriv('aes-256-gcm', key, sealed.subarray(1, 13))
      decipher.setAuthTag(sealed.subarray(sealed.length - 16))
      return Buffer.concat([decipher.update(sealed.subarray(13, sealed.length - 16)), decipher.final()]).toString('utf8')
    },
  }
}
