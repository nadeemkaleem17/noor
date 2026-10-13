// One zod enum for each list of `enums.js` (kept apart: a page that only needs the lists must not load zod).
import { z } from 'zod'
import { enums } from './enums.js'

/**
 * @typedef {{ [K in keyof typeof enums]: z.ZodEnum<{ [V in typeof enums[K][number]]: V }> }} Schemas
 */
/** Zod enum per registry key: `Enum.orderStatus.parse('confirmed')`. */
export const Enum = /** @type {Schemas} */ (/** @type {unknown} */ (Object.fromEntries(Object.entries(enums).map(([k, v]) => [k, z.enum(v)]))))

