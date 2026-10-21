// Two things the owner asked for on 2026-10-21 (plan/17 items 6 and 11): the Trash keeps what was deleted so it can be put back, and staff can make a role of their own and give it to a person.
import path from 'node:path'
import { dataDir, password, staff, urls } from '../env.mjs'
import { adminApi } from '../support/api.js'
import { expectNoViolations } from '../support/axe.js'
import { expect, test } from '../support/test.js'

test.use({ storageState: path.join(dataDir, 'owner.json') })

const run = Date.now().toString(36).slice(-5)

/** A password re-check appears when the sign-in is not fresh. @param {import('@playwright/test').Page} page */
async function confirmIfAsked(page) {
  const again = page.locator('input[type="password"]').last()
  if (await again.isVisible({ timeout: 3000 }).catch(() => false)) {
    await again.fill(password)
    await page.getByRole('dialog', { name: 'Confirm your password' }).getByRole('button', { name: /^Confirm/, exact: false }).last().click()
  }
}

test('a deleted promo code waits in the Trash and is put back with the same words', async ({ page }) => {
  const api = await adminApi()
  const code = `TRASH${run.toUpperCase()}`
  const made = await api.post('/admin/promos', { code, type: 'percent', percent: 12, scope: 'all', excludeSaleItems: false, firstOrderOnly: false, enabled: true })
  await api.delete(`/admin/promos/${made.id}`)
  expect((await api.get('/admin/promos')).items.some((/** @type {{ code: string }} */ p) => p.code === code)).toBe(false)

  await page.goto(`${urls.admin}/trash`)
  const row = page.getByRole('listitem').filter({ hasText: code })
  await expect(row).toBeVisible()
  await expect(row.getByText(/Promo code · deleted .* · kept 30 more days/)).toBeVisible()
  await expectNoViolations(page)
  await row.getByRole('button', { name: 'Put back' }).click()
  await expect(page.getByText(`${code} is back`).first()).toBeVisible()
  await expect(row).toHaveCount(0)
  const back = (await api.get('/admin/promos')).items.find((/** @type {{ code: string }} */ p) => p.code === code)
  expect(back).toMatchObject({ percent: 12, enabled: true })
  await api.delete(`/admin/promos/${back.id}`) // leave the shop as it was (it goes to the trash, which is fine)
  await api.dispose()
})

test('staff make a role of their own, give it to a person, and the person has its access', async ({ page }) => {
  const api = await adminApi()
  const name = `Night packer ${run}`
  const list = await api.get(`/admin/staff?q=${encodeURIComponent('E2E Viewer')}`)
  const viewer = list.items.find((/** @type {{ email: string }} */ s) => s.email === staff.viewer.email)
  expect(viewer, 'the prepared viewer').toBeTruthy()
  try {
    await page.goto(`${urls.admin}/staff/roles`)
    await expectNoViolations(page)
    await page.getByRole('button', { name: 'New role' }).click()
    const dialog = page.getByRole('dialog', { name: 'New role' })
    await dialog.getByLabel(/^Name/).fill(name)
    await dialog.getByLabel('Starts from').selectOption({ label: 'Viewer' })
    await dialog.getByRole('checkbox', { name: /Give orders to riders/ }).check()
    await dialog.getByRole('button', { name: 'Make the role' }).click()
    await confirmIfAsked(page)
    await expect(page.getByRole('heading', { name })).toBeVisible()

    await page.goto(`${urls.admin}/staff/${viewer.id}`)
    const card = page.getByRole('region', { name: 'Role' })
    await card.getByRole('combobox', { name: 'Role' }).selectOption({ label: name })
    await confirmIfAsked(page)
    await expect(page.getByText('Role changed').first()).toBeVisible()
    const after = await api.get(`/admin/staff/${viewer.id}`)
    expect(after.profileId).toBeTruthy()
    expect(after.grants).toEqual(['deliveries:assign'])
    expect(after.permissions).toContain('deliveries:assign')
  } finally {
    const now = await api.get(`/admin/staff/${viewer.id}`)
    await api.put(`/admin/staff/${viewer.id}/permissions`, { grants: [], revokes: [], version: now.version }).catch(() => undefined)
    const roles = await api.get('/admin/access-profiles').catch(() => ({ items: [] }))
    for (const r of roles.items.filter((/** @type {{ name: string }} */ p) => p.name === name)) await api.delete(`/admin/access-profiles/${r.id}`).catch(() => undefined)
    await api.dispose()
  }
})
