// `test` and `expect` of the journeys: the same as Playwright's, except that every browser context a journey opens is a different visitor.
// The shop's server passes the visitor's address to the API, whose limits count it (10 orders in 10 minutes for one address, for example): without
// this every journey would be one address. The server believes the last entry of X-Forwarded-For (TRUSTED_PROXY_HOPS=1 in env.mjs), as it would behind a proxy.
import { expect, test as base } from '@playwright/test'
import { urls } from '../env.mjs'

const range = Math.floor(Math.random() * 200) + 20 // another run, another set of addresses: the API keeps its counts in the database
let next = 0
const visitorAddress = () => `10.${range}.${Math.floor(next / 250)}.${(next++ % 250) + 1}`

export const test = base.extend({
  browser: [
    async ({ browser }, use) => {
      const open = browser.newContext.bind(browser)
      browser.newContext = async (options) => {
        const context = await open(options)
        // only requests to the shop: the same header on a cross-origin call from the admin to the API would be refused at the preflight
        const ip = visitorAddress()
        await context.route(`${urls.storefront}/**`, (route) => route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': ip } }))
        return context
      }
      await use(browser)
    },
    { scope: 'worker' },
  ],
})

export { expect }
