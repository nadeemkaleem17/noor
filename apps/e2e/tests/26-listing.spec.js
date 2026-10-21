// Category pages and cards of plan/06-storefront/11-storefront-v2.md section 5.3 and DOC-06.13 section 6, on the seeded shop.
// REQ: LS-01, LS-06, LS-08, LS-12, PC-04, PC-05, PC-07, PC-08
import { expectNoViolations } from '../support/axe.js'
import { expect, test } from '../support/test.js'

test('a category with sub-categories opens with a tile for each, two rails and then the whole listing', async ({ page }) => {
  await page.goto('/c/women')
  const tiles = page.getByRole('list', { name: 'Shop by category' })
  await expect(tiles.getByRole('link')).toHaveCount(3)
  await expect(tiles.getByRole('link', { name: /Stitched/ })).toContainText('pieces')
  await expect(page.getByRole('heading', { name: 'New in Women' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bestsellers in Women' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'All Women' })).toBeVisible()
  await expectNoViolations(page)
  // filtered, it is the listing and nothing else
  await page.goto('/c/women?sort=newest')
  await expect(page.getByRole('heading', { name: 'New in Women' })).toHaveCount(0)
})

test('a category without sub-categories shows its siblings as chips', async ({ page }) => {
  await page.goto('/c/stitched')
  const chips = page.getByRole('list', { name: 'More categories' })
  await expect(chips.getByRole('link', { name: 'Unstitched' })).toBeVisible()
  await expect(chips.getByRole('link', { name: 'Stitched', exact: true }), 'the page itself is not one of its chips').toHaveCount(0)
  await expectNoViolations(page)
})

test('the filter and sort bar stays at the top while the products scroll', async ({ page }) => {
  await page.goto('/c/women')
  await page.getByRole('heading', { name: 'All Women' }).scrollIntoViewIfNeeded()
  await page.mouse.wheel(0, 700)
  const bar = page.getByRole('status').filter({ hasText: /products?$/ }).locator('xpath=..')
  await expect(async () => {
    const box = await bar.boundingBox()
    expect(box?.y ?? 99).toBeLessThanOrEqual(1)
  }).toPass()
})

test('the density switch changes how many products are in a row and is remembered', async ({ page }) => {
  await page.goto('/c/stitched')
  const columns = () => page.evaluate(() => getComputedStyle(document.querySelector('main ul.grid:not([aria-label])') ?? document.body).gridTemplateColumns.split(' ').length)
  await expect(page.getByRole('button', { name: 'More products per row' })).toHaveAttribute('aria-pressed', 'true')
  expect(await columns()).toBe(4)
  await page.getByRole('button', { name: 'Larger products' }).click()
  await expect(page.getByRole('button', { name: 'Larger products' })).toHaveAttribute('aria-pressed', 'true')
  expect(await columns()).toBe(3)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Larger products' })).toHaveAttribute('aria-pressed', 'true')
  expect(await columns()).toBe(3)
})

test('quick add on a card: the sizes open, a size goes into the bag and the bag opens', async ({ page }) => {
  await page.goto('/c/stitched')
  const card = page.locator('article').filter({ has: page.getByText('Quick add', { exact: true }) }).first()
  await card.getByText('Quick add', { exact: true }).click()
  const size = card.getByRole('button', { name: /^Add size .+ to the bag$/ }).first()
  await expect(size).toBeVisible()
  await size.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText(/Rs/)
})

test('a card shows the fabric line under the name', async ({ page }) => {
  await page.goto('/c/women')
  // some cards (a made-to-order product made by an earlier journey) have no fabric line: look for one that has
  await expect(page.locator('article').filter({ hasText: /\w+ \| \w+/ }).first()).toBeVisible()
})
