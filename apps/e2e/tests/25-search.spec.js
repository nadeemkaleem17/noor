// Search of plan/06-storefront/11-storefront-v2.md section 5.2 on the seeded shop: suggestions while typing, recent and popular words, the keyboard, and the plain form without JavaScript.
// REQ: SR-01, SR-02, SR-03, SR-04, SR-07
import { adminApi } from '../support/api.js'
import { expectNoViolations } from '../support/axe.js'
import { expect, test } from '../support/test.js'

test.describe.configure({ mode: 'serial' })

test('staff keep the popular searches in the Store settings and the search box shows them before anyone types', async ({ page }) => {
  const api = await adminApi()
  const doc = await api.get('/admin/settings/store')
  await api.put('/admin/settings/store', { value: { ...doc.value, popularSearches: ['lawn', 'kurta'] }, version: doc.version })
  await api.dispose()
  await page.goto('/')
  // the shop keeps its settings in memory for 30 s: look again until the new words are there
  await expect(async () => {
    await page.reload()
    await page.getByRole('link', { name: 'Search', exact: true }).click()
    await expect(page.getByRole('option', { name: 'lawn' })).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 45_000 })
  await expect(page.getByText('Popular searches')).toBeVisible()
  await expectNoViolations(page)
})

test('typing offers products, with the keyboard to choose one and Escape to leave', async ({ page }) => {
  await page.goto('/')
  const button = page.getByRole('link', { name: 'Search', exact: true })
  await button.click()
  const box = page.getByRole('combobox')
  await expect(box).toBeFocused()
  await box.fill('kurta')
  const listbox = page.getByRole('listbox', { name: 'Suggestions' })
  await expect(listbox.getByRole('option').first()).toBeVisible()
  await expect(page.getByRole('status')).toContainText('results for “kurta”')
  await expect(listbox.getByRole('option', { name: /^See all \d+ results? for “kurta”$/ })).toBeVisible()
  await expectNoViolations(page)
  await box.press('ArrowDown')
  const first = listbox.getByRole('option').first()
  await expect(first).toHaveAttribute('aria-selected', 'true')
  await expect(box).toHaveAttribute('aria-activedescendant', /.+/)
  await box.press('Escape')
  await expect(listbox).toBeHidden()
  await expect(button).toBeFocused()
  // again, and this time Enter on a chosen product opens its page
  await button.click()
  await page.getByRole('combobox').fill('kurta')
  await expect(page.getByRole('listbox', { name: 'Suggestions' }).getByRole('option').first()).toBeVisible()
  await page.getByRole('combobox').press('ArrowDown')
  await page.getByRole('combobox').press('Enter')
  await expect(page).toHaveURL(/\/(p|c)\//)
})

test('a search made here is remembered in this browser and can be removed', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Search', exact: true }).click()
  await page.getByRole('combobox').fill('lawn')
  await page.getByRole('combobox').press('Enter')
  await expect(page).toHaveURL(/\/search\?q=lawn/)
  await page.getByRole('link', { name: 'Search', exact: true }).click()
  await expect(page.getByText('Recent searches')).toBeVisible()
  await expect(page.getByRole('option', { name: 'lawn' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Remove “lawn” from recent searches' }).click()
  await expect(page.getByText('Recent searches')).toBeHidden()
})

test('a search with no results keeps the words, offers the popular searches and the categories', async ({ page }) => {
  await page.goto('/search?q=zzzzqq')
  await expect(page.getByRole('heading', { name: 'No results for “zzzzqq”' })).toBeVisible()
  await expect(page.getByRole('main').getByRole('searchbox')).toHaveValue('zzzzqq')
  await expect(page.getByRole('main').getByRole('link', { name: 'lawn', exact: true })).toBeVisible()
  await expectNoViolations(page)
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('the search button is a link to the search page, and its form is a plain GET', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Search', exact: true })).toHaveAttribute('href', '/search')
    await page.getByRole('link', { name: 'Search', exact: true }).click()
    await page.getByRole('searchbox').fill('kurta')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page).toHaveURL(/\/search\?q=kurta/)
    await expect(page.getByRole('heading', { name: 'Results for “kurta”' })).toBeVisible()
  })
})
