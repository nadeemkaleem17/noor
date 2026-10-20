// Module access of one person (plan/17-owner-requests-2026-10.md item 11): an owner adds to a viewer's role and takes from it, and the viewer's next request follows.
import path from 'node:path'
import { dataDir, password, staff, urls } from '../env.mjs'
import { adminApi } from '../support/api.js'
import { expectNoViolations } from '../support/axe.js'
import { expect, test } from '../support/test.js'

test.use({ storageState: path.join(dataDir, 'owner.json') })

test('an owner gives the viewer access to delivery runs and takes away the dashboard, then puts it all back', async ({ page }) => {
  const api = await adminApi()
  const list = await api.get(`/admin/staff?q=${encodeURIComponent('E2E Viewer')}`)
  const viewer = list.items.find((/** @type {{ email: string }} */ s) => s.email === staff.viewer.email)
  expect(viewer, 'the prepared viewer').toBeTruthy()
  try {
    await page.goto(`${urls.admin}/staff/${viewer.id}`)
    const card = page.getByRole('region', { name: 'Module access' })
    await expect(card).toBeVisible()
    await expect(card.getByRole('checkbox', { name: /See orders/ })).toBeChecked()
    await expect(card.getByRole('checkbox', { name: /See delivery people and runs/ })).not.toBeChecked()
    await expectNoViolations(page)

    await card.getByRole('checkbox', { name: /See delivery people and runs/ }).check()
    await card.getByRole('checkbox', { name: /See the dashboard/ }).uncheck()
    await expect(card.getByText('added for this person')).toBeVisible()
    await expect(card.getByText('taken away')).toBeVisible()
    await page.getByRole('button', { name: 'Save access' }).click()
    // a change of access asks for the password again when the sign-in is not fresh
    const again = page.getByLabel('Confirm your password')
    if (await again.isVisible({ timeout: 3000 }).catch(() => false)) {
      await again.fill(password)
      await page.getByRole('button', { name: 'Confirm and continue' }).click()
    }
    await expect(page.getByText('Access saved').first()).toBeVisible()

    const saved = await api.get(`/admin/staff/${viewer.id}`)
    expect(saved.grants).toEqual(['deliveries:read'])
    expect(saved.revokes).toEqual(['dashboard:read'])
    expect(saved.permissions).toContain('deliveries:read')
    expect(saved.permissions).not.toContain('dashboard:read')

    // the list says this person has custom access
    await page.goto(`${urls.admin}/staff`)
    await expect(page.getByRole('row', { name: /E2E Viewer/ }).getByText('Custom access')).toBeVisible()
  } finally {
    const now = await api.get(`/admin/staff/${viewer.id}`)
    await api.put(`/admin/staff/${viewer.id}/permissions`, { grants: [], revokes: [], version: now.version }).catch(() => undefined)
    await api.dispose()
  }
})
