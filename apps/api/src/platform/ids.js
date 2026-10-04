// UUIDv7 (RFC 9562): 48-bit millisecond timestamp first, so ids sort in creation order (DOC-08 section 7, DOC-09.0).
import { randomBytes } from 'node:crypto'

let lastMs = 0
let seq = 0

/**
 * Time-ordered id. Ids made in the same millisecond keep their order through a 12-bit counter.
 * @param {number} [nowMs]
 * @returns {string}
 */
export function uuidv7(nowMs = Date.now()) {
  let ms = Math.max(nowMs, lastMs)
  if (ms === lastMs) {
    seq++
    if (seq > 0xfff) {
      ms++ // more than 4096 ids in one millisecond: borrow the next one
      seq = 0
    }
  } else {
    seq = 0
  }
  lastMs = ms
  const b = randomBytes(16)
  b[0] = (ms / 2 ** 40) & 0xff
  b[1] = (ms / 2 ** 32) & 0xff
  b[2] = (ms / 2 ** 24) & 0xff
  b[3] = (ms / 2 ** 16) & 0xff
  b[4] = (ms / 2 ** 8) & 0xff
  b[5] = ms & 0xff
  b[6] = 0x70 | (seq >> 8) // version 7 + counter high bits
  b[7] = seq & 0xff
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80 // variant
  const h = b.toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
