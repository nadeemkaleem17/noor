// The first-run invariant of plan/06-storefront/13-navigation-and-categories.md §3, on the seeded shop as a customer meets it:
// every visible top-level category is in the header, and is on the home page. Not one of the 17 journeys.
// REQ: SH-04, HM-13
//
// EXPECTED TO FAIL until M8-02 and M8-03 (the seed wrote a two-item menu and the header ignored the category tree). `test.fail` makes the run green while it
// is true and red the day the shop is fixed: remove `fail` from the two tests below in that change.
import { urls } from '../env.mjs'
import { expect, test } from '../support/test.js'

/** The top-level categories a customer can see (visible, with products). */
async function topCategories(/** @type {import('@playwright/test').APIRequestContext} */ request) {
  const res = await request.get(`${urls.api}/api/v1/categories`)
  const { items } = await res.json()
  return /** @type {{ handle: string, name: string, productCount: number }[]} */ (items).filter((c) => c.productCount > 0)
}

test.fail('first run: every top category is in the header, one interaction away', async ({ page, request }) => {
  const tops = await topCategories(request)
  expect(tops.length, 'the seeded shop has categories').toBeGreaterThan(0)
  await page.goto('/')
  const nav = page.getByRole('banner').getByRole('navigation').first()
  for (const c of tops) await expect(nav.getByRole('link', { name: c.name, exact: true }), `${c.name} in the header`).toBeVisible()
})

test.fail('first run: every top category appears on the home page', async ({ page, request }) => {
  const tops = await topCategories(request)
  await page.goto('/')
  const main = page.getByRole('main')
  for (const c of tops) await expect(main.locator(`a[href="/c/${c.handle}"]`).first(), `${c.name} on the home page`).toBeVisible()
})
