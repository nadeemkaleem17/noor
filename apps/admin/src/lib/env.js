// Validated once at start-up (plan/03-frontend-architecture.md section 10). There is no admin key variable (ADR-0012).
import { z } from '@noor/contract'

const parsed = z
  .object({
    VITE_API_URL: z.url().default('http://localhost:3000'),
    /** Where "View storefront" points. */
    VITE_STOREFRONT_URL: z.url().default('http://localhost:5174'),
  })
  .parse(import.meta.env)
export const env = { apiUrl: parsed.VITE_API_URL.replace(/\/+$/, ''), storefrontUrl: parsed.VITE_STOREFRONT_URL }
