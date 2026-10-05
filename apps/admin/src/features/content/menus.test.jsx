import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const perms = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'content:read', 'content:write'])
const session = (/** @type {import('@noor/contract').Permission[]} */ permissions = perms) => ({ 'GET /admin/me': () => json(200, me({ permissions })) })
const menu = (/** @type {'main' | 'footer'} */ handle, /** @type {any[]} */ items, version = 2) => json(200, { handle, version, items })
const main = [
  { id: 'a1', label: 'New', href: '/new', targetLive: true },
  { id: 'a2', label: 'Women', href: '/c/women', targetLive: true, children: [{ id: 'a3', label: 'Stitched', href: '/c/stitched', targetLive: false }] },
  { id: 'a4', label: 'Sale', href: '/sale', targetLive: true },
]

describe('menus (plan/07-admin/09-content.md section 4)', () => {
  it('shows the tree and marks an item whose target is not live', async () => {
    fakeApi({ ...session(), 'GET /admin/menus/main': () => menu('main', main) })
    renderApp('/content/menus')
    expect((await screen.findByLabelText('Label of Women')).getAttribute('value') ?? (/** @type {HTMLInputElement} */ (screen.getByLabelText('Label of Women'))).value).toBe('Women')
    expect((/** @type {HTMLInputElement} */ (screen.getByLabelText('Link of Stitched'))).value).toBe('/c/stitched')
    expect(screen.getAllByText('Target not live')).toHaveLength(1)
  })

  it('explains the fallback when the main menu is empty', async () => {
    fakeApi({ ...session(), 'GET /admin/menus/main': () => menu('main', [], 0) })
    renderApp('/content/menus')
    expect(await screen.findByText(/the shop shows its own: New, the top categories, and Sale/)).toBeTruthy()
  })

  it('saves the whole menu with its version: edits, a new link, a move', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({ ...session(), 'GET /admin/menus/main': () => menu('main', main), 'PUT /admin/menus/main': ({ body }) => ((sent = body), menu('main', body.items.map((/** @type {any} */ i) => ({ ...i, id: i.id ?? 'n1', targetLive: true })), 3)) })
    const { user } = renderApp('/content/menus')
    const label = await screen.findByLabelText('Label of Sale')
    await user.clear(label)
    await user.type(label, 'Offers')
    await user.click(screen.getByRole('button', { name: 'Move Offers up' }))
    await user.click(screen.getByRole('button', { name: 'Add a link' }))
    await user.type(screen.getByLabelText('Label of link 4'), 'Contact')
    await user.type(screen.getByLabelText('Link of Contact'), '/pages/contact')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent.version).toBe(2)
    expect(sent.items.map((/** @type {any} */ i) => [i.id, i.label, i.href])).toEqual([['a1', 'New', '/new'], ['a4', 'Offers', '/sale'], ['a2', 'Women', '/c/women'], [undefined, 'Contact', '/pages/contact']])
    expect(sent.items[2].children).toEqual([{ id: 'a3', label: 'Stitched', href: '/c/stitched' }])
  })

  it('refuses a link that is not valid, and says which', async () => {
    const calls = fakeApi({ ...session(), 'GET /admin/menus/main': () => menu('main', main) })
    const { user } = renderApp('/content/menus')
    const link = await screen.findByLabelText('Link of Sale')
    await user.clear(link)
    await user.type(link, 'javascript:alert(1)')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter a valid link.')).toBeTruthy()
    expect(calls.some((c) => c.startsWith('PUT'))).toBe(false)
  })

  it('indents a link under the one above, and outdents it again', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({ ...session(), 'GET /admin/menus/main': () => menu('main', main), 'PUT /admin/menus/main': ({ body }) => ((sent = body), menu('main', [], 3)) })
    const { user } = renderApp('/content/menus')
    await user.click(await screen.findByRole('button', { name: 'Indent Sale' }))
    expect(screen.getByRole('button', { name: 'Outdent Sale' })).toBeTruthy()
    expect((/** @type {HTMLButtonElement} */ (screen.getByRole('button', { name: 'Indent New' }))).disabled).toBe(true) // nothing above the first link
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent.items[1].children.map((/** @type {any} */ c) => c.label)).toEqual(['Stitched', 'Sale'])
  })

  it('has one level in the footer, and the tab is in the address', async () => {
    fakeApi({ ...session(), 'GET /admin/menus/footer': () => menu('footer', [{ id: 'f1', label: 'Privacy', href: '/pages/privacy', targetLive: true }]) })
    renderApp('/content/menus?menu=footer')
    expect(await screen.findByLabelText('Label of Privacy')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Indent / })).toBeNull()
    expect(screen.queryByRole('button', { name: /Add a sub-link/ })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Footer menu', selected: true })).toBeTruthy()
  })

  it('offers "Overwrite with mine" on a stale save, with the fresh version', async () => {
    /** @type {any[]} */
    const puts = []
    let reads = 0
    fakeApi({
      ...session(),
      'GET /admin/menus/main': () => menu('main', main, reads++ === 0 ? 2 : 6),
      'PUT /admin/menus/main': ({ body }) => (puts.push(body), body.version === 2 ? problem(409, 'stale_write', { currentVersion: 6 }) : menu('main', main, 7)),
    })
    const { user } = renderApp('/content/menus')
    const label = await screen.findByLabelText('Label of Sale')
    await user.type(label, '!')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Someone else changed this menu' })).getByRole('button', { name: 'Overwrite with mine' }))
    await waitFor(() => expect(puts.map((p) => p.version)).toEqual([2, 6]))
  })

  it('is read-only without content:write', async () => {
    fakeApi({ ...session(['dashboard:read', 'content:read']), 'GET /admin/menus/main': () => menu('main', main) })
    renderApp('/content/menus')
    expect((/** @type {HTMLInputElement} */ (await screen.findByLabelText('Label of New'))).readOnly).toBe(true)
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add a link' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull()
  })
})
