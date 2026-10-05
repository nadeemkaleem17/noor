import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const u = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-0000000009${String(n).padStart(2, '0')}`
const page = (/** @type {Record<string, unknown>} */ over = {}) => ({
  id: u(1), title: 'About', slug: 'about', bodyMd: '## Our story\n\nWe sew.', status: 'active', locked: false, version: 3, updatedAt: '2026-10-05T10:00:00.000Z', updatedBy: 'Ayesha Khan', storefrontUrl: '/pages/about', ...over,
})
const row = (/** @type {Record<string, unknown>} */ over = {}) => ({ id: u(1), title: 'About', slug: 'about', status: 'active', locked: false, updatedAt: '2026-10-05T10:00:00.000Z', updatedBy: 'Ayesha Khan', ...over })
const perms = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'content:read', 'content:write', 'content:delete'])
const session = (/** @type {import('@noor/contract').Permission[]} */ permissions = perms) => ({ 'GET /admin/me': () => json(200, me({ permissions })) })
const open = `/admin/pages/${u(1)}`

describe('pages list (plan/07-admin/09-content.md section 3.1)', () => {
  it('lists pages with their address, marking the ones the shop needs', async () => {
    fakeApi({ ...session(), 'GET /admin/pages': () => json(200, { items: [row(), row({ id: u(2), title: 'Privacy', slug: 'privacy', locked: true })], total: 2, page: 1, size: 50 }) })
    renderApp('/content/pages')
    expect(await screen.findByRole('link', { name: 'About' })).toBeTruthy()
    expect(screen.getByText('/pages/privacy')).toBeTruthy()
    expect(screen.getAllByLabelText('Required page')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'New page' }).getAttribute('href')).toBe('/content/pages/new')
  })
})

describe('page editor (plan/07-admin/09-content.md section 3.2)', () => {
  it('previews the body as the server resolved it, through the shared renderer', async () => {
    /** @type {string[]} */
    const previewed = []
    fakeApi({
      ...session(),
      [`GET ${open}`]: () => json(200, page({ bodyMd: 'Call {{store.phone}}' })),
      'POST /admin/pages/preview': ({ body }) => (previewed.push(body.bodyMd), json(200, { bodyMd: body.bodyMd.replace('{{store.phone}}', '0300 1234567') })),
    })
    const { user } = renderApp(`/content/pages/${u(1)}`)
    await screen.findByLabelText('Body')
    await user.click(screen.getByRole('tab', { name: 'Preview' }))
    expect(await screen.findByText('Call 0300 1234567')).toBeTruthy()
    expect(previewed).toEqual(['Call {{store.phone}}'])
    await user.click(screen.getByRole('tab', { name: 'Write' }))
    expect((await screen.findByLabelText('Body') /** @type {HTMLTextAreaElement} */).getAttribute('name')).toBe('bodyMd')
  })

  it('inserts a token where the caret is', async () => {
    fakeApi({ ...session(), [`GET ${open}`]: () => json(200, page({ bodyMd: 'Call us.' })) })
    const { user } = renderApp(`/content/pages/${u(1)}`)
    const body = /** @type {HTMLTextAreaElement} */ (await screen.findByLabelText('Body'))
    body.focus()
    body.setSelectionRange(5, 5) // after "Call "
    await user.click(screen.getByRole('button', { name: '{{store.phone}}' }))
    await waitFor(() => expect(body.value).toBe('Call {{store.phone}}us.'))
  })

  it('inserts an uploaded picture with its alt text and size, and will not insert without alt text', async () => {
    const mediaId = u(50)
    vi.stubGlobal('createImageBitmap', async () => ({ width: 1600, height: 1200, close() {} }))
    fakeApi({
      ...session(),
      [`GET ${open}`]: () => json(200, page({ bodyMd: 'Hi' })),
      'POST /admin/media/uploads': () => json(200, { mediaId, uploadUrl: 'http://localhost:3000/storage/put/p', headers: {}, expiresAt: '2026-10-05T11:00:00.000Z' }),
      'PUT /storage/put/p': () => json(200, {}),
      [`POST /admin/media/${mediaId}/confirm`]: () => json(200, { id: mediaId, kind: 'image', status: 'ready', bytes: 1, alt: '', createdAt: '2026-10-05T10:00:00.000Z', width: 1600, height: 1200, image: { src: 'http://localhost:3000/img/p/640.jpg', srcset: '', width: 1600, height: 1200, alt: '' } }),
    })
    const { user } = renderApp(`/content/pages/${u(1)}`)
    const input = await screen.findByLabelText('Choose an image to insert')
    fireEvent.change(input, { target: { files: [new File(['x'], 'p.jpg', { type: 'image/jpeg' })] } })
    const dialog = await screen.findByRole('dialog', { name: 'Insert image' })
    expect(/** @type {HTMLButtonElement} */ (within(dialog).getByRole('button', { name: 'Insert' })).disabled).toBe(true)
    await user.type(within(dialog).getByLabelText(/^Alt text/), 'Our atelier')
    await user.click(within(dialog).getByRole('button', { name: 'Insert' }))
    await waitFor(() => expect((/** @type {HTMLTextAreaElement} */ (screen.getByLabelText('Body'))).value).toContain('![Our atelier](http://localhost:3000/img/p/640.jpg "1600x1200")'))
  })

  it('saves with the stored version', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({ ...session(), [`GET ${open}`]: () => json(200, page()), [`PUT ${open}`]: ({ body }) => ((sent = body), json(200, page({ ...body, version: 4 }))) })
    const { user } = renderApp(`/content/pages/${u(1)}`)
    const title = await screen.findByLabelText(/^Title/)
    await user.clear(title)
    await user.type(title, 'About us')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0] ?? title)
    await waitFor(() => expect(sent).not.toBeNull())
    expect(sent).toMatchObject({ title: 'About us', slug: 'about', status: 'active', version: 3, bodyMd: '## Our story\n\nWe sew.' })
    expect(sent).not.toHaveProperty('seo')
  })

  it('creates a page with the address made from the title', async () => {
    /** @type {any} */
    let sent = null
    fakeApi({
      ...session(),
      'POST /admin/pages': ({ body }) => ((sent = body), json(201, page({ ...body, id: u(9), version: 1 }))),
      [`GET /admin/pages/${u(9)}`]: () => json(200, page({ id: u(9), title: 'Size guide', slug: 'size-guide', version: 1 })),
    })
    const { router, user } = renderApp('/content/pages/new')
    await user.type(await screen.findByLabelText(/^Title/), 'Size Guide')
    expect((/** @type {HTMLInputElement} */ (screen.getByLabelText(/^Address/))).value).toBe('size-guide')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0] ?? document.body)
    await waitFor(() => expect(router.state.location.pathname).toBe(`/content/pages/${u(9)}`))
    expect(sent).toMatchObject({ title: 'Size Guide', slug: 'size-guide', status: 'draft', bodyMd: '' })
  })

  it('a required page has a fixed address, cannot be set to draft, and has no Delete', async () => {
    fakeApi({ ...session(), [`GET ${open}`]: () => json(200, page({ locked: true, slug: 'privacy', title: 'Privacy' })) })
    renderApp(`/content/pages/${u(1)}`)
    const slug = await screen.findByLabelText(/^Address/)
    expect(/** @type {HTMLInputElement} */ (slug).readOnly).toBe(true)
    expect(within(screen.getByRole('combobox', { name: 'Status' })).getAllByRole('option').map((o) => o.textContent)).toEqual(['Active'])
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(screen.getByText(/cannot be unpublished or deleted/)).toBeTruthy()
  })

  it('offers Delete on an ordinary page, and goes back to the list after it', async () => {
    fakeApi({ ...session(), [`GET ${open}`]: () => json(200, page()), [`DELETE ${open}`]: () => json(204) })
    const { router, user } = renderApp(`/content/pages/${u(1)}`)
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/content/pages'))
  })

  it('handles a stale save: reload their version, or overwrite with the fresh version', async () => {
    /** @type {any[]} */
    const puts = []
    let reads = 0
    fakeApi({
      ...session(),
      [`GET ${open}`]: () => json(200, reads++ === 0 ? page() : page({ title: 'Theirs', version: 6 })),
      [`PUT ${open}`]: ({ body }) => (puts.push(body), body.version === 3 ? problem(409, 'stale_write', { currentVersion: 6 }) : json(200, page({ ...body, version: 7 }))),
    })
    const { user } = renderApp(`/content/pages/${u(1)}`)
    await user.type(await screen.findByLabelText(/^Title/), '!')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0] ?? document.body)
    const dialog = await screen.findByRole('dialog', { name: 'Someone else changed this page' })
    await user.click(within(dialog).getByRole('button', { name: 'Overwrite with mine' }))
    await waitFor(() => expect(puts.map((p) => p.version)).toEqual([3, 6]))
  })

  it('is read-only without content:write', async () => {
    fakeApi({ ...session(['dashboard:read', 'content:read']), [`GET ${open}`]: () => json(200, page()) })
    renderApp(`/content/pages/${u(1)}`)
    expect((/** @type {HTMLInputElement} */ (await screen.findByLabelText(/^Title/))).readOnly).toBe(true)
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Insert image' })).toBeNull()
  })
})
