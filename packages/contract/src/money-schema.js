// The schema of the JSON shape of money (ADR-0013). Apart from `money.js` so that the shop's pages, which only add and print amounts, do not load zod.
import { z } from 'zod'

export const Money = z.strictObject({ amount: z.number().int().safe(), currency: z.literal('PKR') })
/**
 * @typedef {z.infer<typeof Money>} Money
 */
