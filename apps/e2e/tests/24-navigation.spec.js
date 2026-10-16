// The header and the phone menu of plan/06-storefront/13-navigation-and-categories.md section 4, on the seeded shop as a customer meets it.
// REQ: SH-04, SH-05
import { expectNoViolations } from '../support/axe.js'
import { urls } from '../env.mjs'
import { expect, test } from '../support/test.js'

/** @typedef {{ handle: string, name: string, productCount: number, children?: Category[] }} Category */

/** The first top-level category a customer can see that has sub-categories (the shop's own data, so the test follows it). @param {import('@playwright/test').APIRequestContext} request */
async function parentWithChildren(request) {
  const { items } = await (await request.get(`${urls.api}/api/v1/categories`)).json()
  const parent = /** @type {Category[]} */ (items).find((c) => c.productCount > 0 && c.children?.some((k) => k.productCount > 0))
  expect(parent, 'the seeded shop has a category with sub-categories').toBeTruthy()
  return /** @type {Category} */ (parent)
}

test('the links of every panel are in the page itself, so they work without JavaScript', async ({ request }) => {
  const parent = await parentWithChildren(request)
  const html = await (await request.get('/')).text()
  expect(html).toContain(`href="/c/${parent.handle}"`)
  for (const child of parent.children ?? []) if (child.productCount > 0) expect(html, `${child.name} in the header`).toContain(`href="/c/${child.handle}"`)
})

test('a panel opens from the button with the keyboard, is clean for a screen reader, and Escape closes it and returns to the button', async ({ page, request }) => {
  const parent = await parentWithChildren(request)
  await page.goto('/')
  const nav = page.getByRole('banner').getByRole('navigation')
  const button = nav.getByRole('button', { name: `${parent.name}: show links` })
  await button.focus()
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('Enter')
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  const all = nav.getByRole('link', { name: `View all ${parent.name}` })
  await expect(all).toBeVisible()
  await expectNoViolations(page)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Escape')
  await expect(button).toBeFocused()
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await expect(all).toBeHidden()
})

test('the pointer opens a panel, and moving away closes it', async ({ page, request }) => {
  const parent = await parentWithChildren(request)
  await page.goto('/')
  const nav = page.getByRole('banner').getByRole('navigation')
  await nav.getByRole('link', { name: parent.name, exact: true }).hover()
  await expect(nav.getByRole('link', { name: `View all ${parent.name}` })).toBeVisible()
  await page.mouse.move(640, 700)
  await expect(nav.getByRole('link', { name: `View all ${parent.name}` })).toBeHidden()
})

test('the header has a Track order link, and the search and bag are there', async ({ page }) => {
  await page.goto('/')
  const header = page.getByRole('banner')
  await expect(header.getByRole('link', { name: 'Track order' })).toHaveAttribute('href', '/track')
  await expect(header.getByRole('link', { name: 'Search' })).toBeVisible()
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 800 } })

  test('the menu drills down: a category opens its children, "All <name>" keeps its page reachable, Back returns', async ({ page, request }) => {
    const parent = await parentWithChildren(request)
    await page.goto('/')
    await page.getByRole('button', { name: 'Menu' }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer.getByRole('searchbox', { name: 'Search the shop' })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Track order' })).toBeVisible()
    await drawer.getByRole('button', { name: parent.name, exact: true }).click()
    await expect(drawer.getByRole('button', { name: 'Back to Menu' })).toBeVisible()
    for (const child of parent.children ?? []) if (child.productCount > 0) await expect(drawer.getByRole('link', { name: child.name, exact: true })).toBeVisible()
    await expectNoViolations(page)
    await drawer.getByRole('button', { name: 'Back to Menu' }).click()
    await expect(drawer.getByRole('button', { name: parent.name, exact: true })).toBeVisible()
    await drawer.getByRole('button', { name: parent.name, exact: true }).click()
    await drawer.getByRole('link', { name: `All ${parent.name}` }).click()
    await expect(page).toHaveURL(new RegExp(`/c/${parent.handle}$`))
    await expect(drawer).toBeHidden()
  })
})
