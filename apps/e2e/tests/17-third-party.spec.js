// E2E-17: the shop talks only to itself: no request from the home page, a listing, a product, the cart or the checkout goes to another site (DOC-06.10 section 7, DOC-12 section 6.1).
import { expect, test } from '../support/test.js'
import { urls } from '../env.mjs'
import { addToCart } from '../support/shop.js'

/** The hosts that are the shop's own: the site, and the host its pictures are served from. */
const own = new Set([new URL(urls.storefront).host, new URL(urls.api).host])

test('E2E-17 no request leaves the shop', async ({ page }) => {
  /** @type {string[]} */
  const outside = []
  /** @type {string[]} */
  const seen = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.protocol === 'data:' || url.protocol === 'blob:') return
    seen.push(url.host)
    if (!own.has(url.host)) outside.push(`${request.method()} ${request.url()}`)
  })

  const visit = async (/** @type {string} */ path) => {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
  }
  await visit('/')
  await visit('/c/stitched')
  await visit('/p/cotton-kurta')
  await addToCart(page, 'cotton-kurta', 'M')
  await visit('/cart')
  await visit('/checkout')

  expect(seen.length, 'the pages did make requests (the check is not empty)').toBeGreaterThan(20)
  expect(outside).toEqual([])
})
