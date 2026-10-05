import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { categoriesAnswer, fakeApi, ids2, json, me, productFixture, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const mediaId = '0194f1b2-7c3a-7000-8000-0000000002a1'
const session = {
  'GET /admin/me': () => json(200, me({ permissions: ['dashboard:read', 'products:read', 'products:write', 'content:read', 'content:write', 'catalog:read'] })),
  'GET /admin/categories': categoriesAnswer,
  'GET /admin/size-systems': () => json(200, { items: [] }),
  'POST /admin/products/publish-checks': () => json(200, { checks: [] }),
}
const open = `/admin/products/${ids2.product}`
const info = (/** @type {Record<string, unknown>} */ over = {}) => ({
  id: mediaId, kind: 'image', status: 'ready', bytes: 1000, alt: '', createdAt: '2026-10-05T10:00:00.000Z', width: 1600, height: 1200,
  image: { src: 'http://localhost:3000/img/a/640.jpg', srcset: '', width: 1600, height: 1200, alt: '' }, ...over,
})
const picture = (/** @type {number} */ side, name = 'kurta.jpg', type = 'image/jpeg') => {
  vi.stubGlobal('createImageBitmap', async () => ({ width: side, height: Math.round(side * 0.75), close() {} }))
  return new File(['x'], name, { type })
}
const slot = { 'POST /admin/media/uploads': () => json(200, { mediaId, uploadUrl: 'http://localhost:3000/storage/put/a', headers: { 'content-type': 'image/jpeg' }, expiresAt: '2026-10-05T11:00:00.000Z' }), 'PUT /storage/put/a': () => json(200, {}) }

describe('product media (plan/07-admin/03-products.md section 6)', () => {
  it('uploads straight to storage, waits for the server to process the file, and saves the picture with its alt text', async () => {
    /** @type {any} */
    let saved = null
    const reads = [info({ status: 'pending', image: undefined })]
    fakeApi({
      ...session,
      ...slot,
      [`GET ${open}`]: () => json(200, productFixture()),
      'POST /admin/media/a1/confirm': () => json(200, reads[0]),
      [`POST /admin/media/${mediaId}/confirm`]: () => json(200, info({ status: 'pending', image: undefined })),
      [`GET /admin/media/${mediaId}`]: () => json(200, info()),
      [`PUT ${open}`]: ({ body }) => {
        saved = body
        return json(200, productFixture({ ...body, version: 4 }))
      },
    })
    const { user } = renderApp(`/products/${ids2.product}`)
    await user.upload(await screen.findByLabelText('Drop pictures here or choose files'), picture(1600))
    const alt = await screen.findByLabelText('Alt text', {}, { timeout: 10_000 })
    expect(document.querySelector('img[src="http://localhost:3000/img/a/640.jpg"]')).toBeTruthy()
    await user.type(alt, 'Ivory cotton kurta on a model')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0] ?? alt)
    await waitFor(() => expect(saved).not.toBeNull())
    expect(saved.media).toEqual([{ mediaId, alt: 'Ivory cotton kurta on a model' }])
  }, 30_000)

  it('refuses a picture that is too small without calling the server, and warns about one that is acceptable but small', async () => {
    const calls = fakeApi({ ...session, ...slot, [`GET ${open}`]: () => json(200, productFixture()), [`POST /admin/media/${mediaId}/confirm`]: () => json(200, info()) })
    const { user } = renderApp(`/products/${ids2.product}`)
    const input = await screen.findByLabelText('Drop pictures here or choose files')
    await user.upload(input, picture(600))
    expect((await screen.findByRole('alert')).textContent).toContain('only 600 pixels')
    expect(calls.some((c) => c.includes('uploads'))).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))

    await user.upload(input, picture(1000))
    expect((await screen.findAllByText(/1000 pixels on its long side; 1200 or more looks better/)).length).toBeGreaterThan(0)
  })

  it('refuses the wrong type before asking for a slot', async () => {
    const calls = fakeApi({ ...session, ...slot, [`GET ${open}`]: () => json(200, productFixture()) })
    renderApp(`/products/${ids2.product}`)
    // the picker's accept list is advisory (a dragged file or an edited picker gets past it); the check is ours
    const input = await screen.findByLabelText('Drop pictures here or choose files')
    fireEvent.change(input, { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } })
    expect((await screen.findByRole('alert')).textContent).toContain('Only JPEG, PNG, WebP and AVIF')
    expect(calls.some((c) => c.includes('uploads'))).toBe(false)
  })

  it('shows the server\'s reason when it rejects the file', async () => {
    fakeApi({
      ...session,
      ...slot,
      [`GET ${open}`]: () => json(200, productFixture()),
      [`POST /admin/media/${mediaId}/confirm`]: () => json(200, info({ status: 'rejected', rejectReason: 'The file is not really a picture', image: undefined })),
    })
    const { user } = renderApp(`/products/${ids2.product}`)
    await user.upload(await screen.findByLabelText('Drop pictures here or choose files'), picture(1600))
    expect((await screen.findByRole('alert', {}, { timeout: 10_000 })).textContent).toBe('The file is not really a picture')
  })

  it('reorders, makes a picture the main one, and removes one', async () => {
    const image = (/** @type {string} */ n) => ({ src: `http://localhost:3000/img/${n}.jpg`, srcset: '', width: 1600, height: 1200, alt: '' })
    const a = '0194f1b2-7c3a-7000-8000-0000000002a2'
    const b = '0194f1b2-7c3a-7000-8000-0000000002a3'
    const c = '0194f1b2-7c3a-7000-8000-0000000002a4'
    /** @type {any} */
    let saved = null
    fakeApi({
      ...session,
      [`GET ${open}`]: () => json(200, productFixture({ media: [{ mediaId: a, alt: 'first', image: image('a') }, { mediaId: b, alt: 'second', image: image('b') }, { mediaId: c, alt: 'third', image: image('c') }] })),
      [`PUT ${open}`]: ({ body }) => {
        saved = body
        return json(200, productFixture({ ...body, version: 4 }))
      },
    })
    const { user } = renderApp(`/products/${ids2.product}`)
    await user.click(await screen.findByRole('button', { name: 'Make picture 3 the main one' }))
    await user.click(screen.getByRole('button', { name: 'Move picture 2 later' }))
    await user.click(screen.getByRole('button', { name: 'Remove picture 1' }))
    const alts = screen.getAllByLabelText('Alt text').map((i) => /** @type {HTMLInputElement} */ (i).value)
    expect(alts).toEqual(['second', 'first'])
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0] ?? document.body)
    await waitFor(() => expect(saved).not.toBeNull())
    expect(saved.media.map((/** @type {any} */ m) => m.mediaId)).toEqual([b, a])
    expect(saved.media[0]).not.toHaveProperty('image')
  })

  it('offers "Shown for" when the product has options', async () => {
    const m = '0194f1b2-7c3a-7000-8000-0000000002a2'
    fakeApi({
      ...session,
      [`GET ${open}`]: () =>
        json(200, productFixture({
          media: [{ mediaId: m, alt: 'x', image: { src: 'http://localhost:3000/img/a.jpg', srcset: '', width: 1600, height: 1200, alt: '' } }],
          options: [{ id: ids2.cat, name: 'Material', role: 'material', display: 'select', values: [{ id: ids2.cat2, key: 'lawn', label: 'Lawn', kind: 'standard' }] }],
        })),
    })
    renderApp(`/products/${ids2.product}`)
    const select = await screen.findByLabelText('Shown for')
    expect(within(select).getByRole('option', { name: 'Material: Lawn' })).toBeTruthy()
  })
})
