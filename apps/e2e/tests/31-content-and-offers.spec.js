// The content, trust and offers pages (plan/06-storefront/14-site-blueprint.md CM-01 to CM-07, TR-01, MK-01) on the seeded shop.
// REQ: CM-01, CM-03, CM-05, CM-07, TR-01, MK-01
import { adminApi, createPromo } from '../support/api.js'
import { expectNoViolations } from '../support/axe.js'
import { expect, test } from '../support/test.js'

test('the shipping page lists each delivery zone with its fee, days and threshold, from the shipping settings', async ({ page }) => {
  await page.goto('/pages/shipping-returns')
  const zones = page.getByRole('heading', { name: 'Fees and times by area' }).locator('xpath=following-sibling::ul[1]/li')
  await expect(zones.first()).toContainText(/Rs\. [\d,]+, \d+ to \d+ days/)
  expect(await zones.count()).toBeGreaterThanOrEqual(2)
  await expectNoViolations(page)
})

test('the FAQ and the care guide exist, are in the footer under Help, and the FAQ carries FAQPage data', async ({ page }) => {
  await page.goto('/pages/faq')
  await expect(page.getByRole('heading', { level: 1, name: 'Questions and answers' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'How do I order?' })).toBeVisible()
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents()
  const faq = ld.map((t) => JSON.parse(t)).find((d) => d['@type'] === 'FAQPage')
  expect(faq?.mainEntity.length, 'every question is in the data').toBeGreaterThanOrEqual(8)
  const help = page.getByRole('contentinfo')
  await expect(help.getByRole('link', { name: 'Questions and answers' })).toHaveAttribute('href', '/pages/faq')
  await expect(help.getByRole('link', { name: 'Fabric and care' })).toHaveAttribute('href', '/pages/care')
  await page.goto('/pages/care')
  await expect(page.getByRole('heading', { name: 'Lawn and cotton' })).toBeVisible()
  await expectNoViolations(page)
})

test('a product links to the care guide', async ({ page }) => {
  await page.goto('/p/cotton-kurta')
  await page.locator('summary', { hasText: 'Fabric and care' }).click()
  await expect(page.getByRole('link', { name: 'Fabric and care guide' })).toHaveAttribute('href', '/pages/care')
})

test('the About page says how orders are made and where the shop is', async ({ page }) => {
  await page.goto('/pages/about')
  await expect(page.getByRole('heading', { name: 'How an order is made and sent' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Where we are' })).toBeVisible()
})

test('the footer of every page has the trust row', async ({ page }) => {
  for (const path of ['/', '/c/stitched', '/pages/about']) {
    await page.goto(path)
    const trust = page.getByRole('contentinfo').getByRole('list', { name: 'Why shop here' })
    await expect(trust.getByRole('link', { name: /Cash on delivery/ })).toBeVisible()
    await expect(trust.getByRole('link', { name: /returns/ })).toBeVisible()
  }
})

test('a promo staff make public is on the Offers page with its code and rule, and the footer links to it', async ({ page }) => {
  const api = await adminApi()
  const offerCode = `WELCOME${Date.now().toString(36).slice(-5).toUpperCase()}` // one a run: a code cannot be made twice
  await createPromo(api, { code: offerCode, percent: 10, minSpendRupees: 3000 }).then(async (p) => {
    // made public after creating it, the way staff do it from the form
    await api.put(`/admin/promos/${p.id}`, { ...Object.fromEntries(Object.entries(p).filter(([k]) => !['id', 'status', 'usageCount', 'used', 'targets', 'summary', 'createdAt'].includes(k))), public: true })
  })
  await api.dispose()
  await page.goto('/offers')
  // the shop keeps what it knows for 30 s: look again until the code is there
  await expect(async () => {
    await page.reload()
    await expect(page.getByText(offerCode)).toBeVisible({ timeout: 1500 })
    // the footer link comes from the shell data, which is kept for 30 s on its own: it is looked at in the same loop
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Offers' })).toHaveAttribute('href', '/offers', { timeout: 1500 })
  }).toPass({ timeout: 45_000 })
  await expect(page.getByRole('listitem').filter({ hasText: offerCode }).getByText(/10% off, on orders over Rs\. 3,000/)).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: offerCode }).getByRole('button', { name: 'Copy code' })).toBeVisible()
  await expectNoViolations(page)
})
