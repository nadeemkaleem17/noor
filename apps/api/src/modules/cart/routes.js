// Handlers for the cart routes of the contract (plan/10-api/03-cart-orders-public.md section 2). The storefront server copies the `nc_cart` cookie into `X-Cart-Token`.
import { sha256Hex } from '../auth/tokens.js'

/**
 * @param {ReturnType<typeof import('./service.js').createCartService>} s
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function cartHandlers(s) {
  /** The token, and the cart's own rate limit once there is one to count against. @param {{ http: { header: (name: string) => string | undefined }, limit: (bucket: string, by: 'cart', subject: string) => Promise<void> }} ctx */
  async function tokenOf({ http, limit }) {
    const token = http.header('x-cart-token')
    if (token) await limit('cart', 'cart', sha256Hex(token).slice(0, 16))
    return token
  }

  return {
    'cart.get': async (ctx) => s.get(await tokenOf(ctx), Boolean(ctx.query.summary)),
    'cart.addLine': async (ctx) => s.addLine(await tokenOf(ctx), ctx.body),
    'cart.setLineQuantity': async (ctx) => s.setLineQuantity(await tokenOf(ctx), ctx.params.lineId, ctx.body.quantity),
    'cart.removeLine': async (ctx) => s.removeLine(await tokenOf(ctx), ctx.params.lineId),
    'cart.applyPromo': async (ctx) => s.applyPromo(await tokenOf(ctx), ctx.body.code),
    'cart.removePromo': async (ctx) => s.removePromo(await tokenOf(ctx)),
    'cart.quote': async (ctx) => s.quote(await tokenOf(ctx), ctx.body),
  }
}
