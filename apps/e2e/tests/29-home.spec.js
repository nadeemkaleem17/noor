// The home page of plan/06-storefront/13-navigation-and-categories.md section 5 on the seeded shop: tabs by category, a block for each category, every category twice.
// REQ: HM-02, HM-03, HM-06, HM-07, HM-13
import { urls } from '../env.mjs'
import { expectNoViolations } from '../support/axe.js'
import { expect, test } from '../support/test.js'

/** @param {import('@playwright/test').APIRequestContext} request */
async function topCategories(request) {
  const { items } = await (await request.get(`${urls.api}/api/v1/categories`)).json()
  return /** @type {{ handle: string, name: string, productCount: number }[]} */ (items).filter((c) => c.productCount > 0)
}

test('every top category is on the home page twice: a round picture and a block of its own', async ({ page, request }) => {
  await page.goto('/')
  const main = page.getByRole('main')
  await main.getByRole('region', { name: 'The shop by category' }).scrollIntoViewIfNeeded()
  for (const c of await topCategories(request)) {
    expect(await main.locator(`a[href="/c/${c.handle}"]`).count(), `${c.name} on the home page`).toBeGreaterThanOrEqual(2)
    await expect(main.getByRole('region', { name: 'The shop by category' }).getByRole('heading', { name: c.name, exact: true })).toBeVisible()
  }
  await expectNoViolations(page)
})

test('New in has a tab for each category; a tab is a link, and with JavaScript it swaps the pieces in place', async ({ page, request }) => {
  const [first] = await topCategories(request)
  await page.goto('/')
  const section = page.getByRole('region', { name: 'New arrivals' })
  const tab = section.getByRole('list', { name: 'Show by category' }).getByRole('link', { name: first?.name ?? '', exact: true })
  await expect(tab).toHaveAttribute('href', `/c/${first?.handle}?sort=newest`)
  await section.scrollIntoViewIfNeeded()
  await tab.click()
  await expect(page, 'the page did not navigate').toHaveURL(/\/$/)
  await expect(tab).toHaveAttribute('aria-current', 'true')
  await expect(section.getByRole('link', { name: `View all ${first?.name}` })).toBeVisible()
  await expect(section.locator('article')).not.toHaveCount(0)
  expect(await section.locator('article a[href^="/p/"]').count()).toBeGreaterThan(0)
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('the tabs are links to the category pages (the bestsellers stream in with a script, so New in is used)', async ({ page, request }) => {
    const [first] = await topCategories(request)
    await page.goto('/')
    await page.getByRole('region', { name: 'New arrivals' }).getByRole('link', { name: first?.name ?? '', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/c/${first?.handle}\\?sort=newest`))
  })
})
