// The customer's order link (plan/10-api/03-cart-orders-public.md section 4): a token derived from the order id, so it can be handed out again
// after a verified lookup without ever being stored. The database keeps only its SHA-256.
import { createHmac } from 'node:crypto'
import { sha256Hex } from '../auth/tokens.js'

/** The secret: `TRACKING_KEY`, or in local development and CI one derived from the data key. @param {import('../../platform/config.js').Config} config */
const keyOf = (config) => config.TRACKING_KEY ?? createHmac('sha256', Buffer.from(config.DATA_ENCRYPTION_KEY, 'base64')).update('rubaya-order-tracking').digest('hex')

/** @param {import('../../platform/config.js').Config} config @param {string} orderId */
export const trackingToken = (config, orderId) => createHmac('sha256', keyOf(config)).update(orderId).digest('base64url')

/** What `orders.tracking_token_hash` holds. @param {string} token */
export const trackingHash = (token) => sha256Hex(token)
