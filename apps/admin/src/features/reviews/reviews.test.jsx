import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeApi, json, me, problem, renderApp, resetApp } from '@/test/app'

afterEach(resetApp)

const uuid = (/** @type {number} */ n) => `0194f1b2-7c3a-7000-8000-${String(n).padStart(12, '0')}`
const ids = { r1: uuid(4001), r2: uuid(4002), product: uuid(4010), order: uuid(4020), photo1: uuid(4031), photo2: uuid(4032) }
const photo = (/** @type {string} */ mediaId) => ({ mediaId, src: `http://localhost:3000/img/${mediaId}.jpg`, srcset: '', width: 800, height: 800, alt: '' })

/** One review as `admin.reviews.get` gives it. @param {Record<string, unknown>} [over] */
const reviewFixture = (over = {}) => ({
  id: ids.r1,
  product: { id: ids.product, title: 'Lawn Suit' },
  order: { id: ids.order, orderNumber: 'RB-10458' },
  displayName: 'Sana M.',
  rating: 5,
  title: 'Lovely fit',
  body: 'The fabric is soft and the colours are just as in the pictures. I will order again for Eid.',
  fit: 'true_to_size',
  photos: [photo(ids.photo1), photo(ids.photo2)],
  status: 'pending',
  createdAt: '2026-10-05T10:00:00.000Z',
  ...over,
})
const page = (/** @type {unknown[]} */ items) => json(200, { items, total: items.length, page: 1, size: 50 })
const reader = /** @type {import('@noor/contract').Permission[]} */ (['dashboard:read', 'reviews:read'])
const moderator = /** @type {import('@noor/contract').Permission[]} */ ([...reader, 'reviews:moderate'])
/** @param {import('@noor/contract').Permission[]} permissions @param {Record<string, (r: { body: any; headers: Headers; url: URL }) => Response>} [more] */
const session = (permissions, more = {}) => ({
  'GET /admin/me': () => json(200, me({ permissions })),
  'GET /admin/nav/counts': () => json(200, { reviewsPending: 2 }),
  ...more,
})
const one = `/admin/reviews/${ids.r1}`

describe('review queue (plan/07-admin/08-reviews.md section 2)', () => {
  it('starts on the pending reviews and shows the stars, the words, the product, the author with the order, and the fit', async () => {
    /** @type {string[]} */
    const asked = []
    fakeApi(session(moderator, { 'GET /admin/reviews': ({ url }) => (asked.push(url.search), page([reviewFixture()])) }))
    renderApp('/reviews')
    expect(await screen.findByRole('img', { name: '5 out of 5 stars' })).toBeTruthy()
    expect(asked[0]).toContain('status=pending')
    const table = screen.getByRole('table')
    expect(within(table).getByText('Lovely fit')).toBeTruthy()
    expect(within(table).getByRole('link', { name: 'Lawn Suit' }).getAttribute('href')).toBe(`/products/${ids.product}`)
    expect(within(table).getByRole('link', { name: 'RB-10458' }).getAttribute('href')).toBe(`/orders/${ids.order}`)
    expect(within(table).getByText('True to size')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pending' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('the tabs are the status in the address, and "All" asks for no status', async () => {
    /** @type {(string | null)[]} */
    const asked = []
    fakeApi(session(moderator, { 'GET /admin/reviews': ({ url }) => (asked.push(url.searchParams.get('status')), page([reviewFixture()])) }))
    const { user } = renderApp('/reviews')
    await screen.findByRole('img', { name: '5 out of 5 stars' })
    await user.click(screen.getByRole('button', { name: 'Approved' }))
    await waitFor(() => expect(asked.at(-1)).toBe('approved'))
    await user.click(screen.getByRole('button', { name: 'All' }))
    await waitFor(() => expect(asked.at(-1)).toBeNull())
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('approves from the row with one call', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(session(moderator, { 'GET /admin/reviews': () => page([reviewFixture()]), [`POST ${one}/moderation`]: ({ body }) => ((sent = body), json(200, reviewFixture({ status: 'approved' }))) }))
    const { user } = renderApp('/reviews')
    await user.click(await screen.findByRole('button', { name: 'Approve the review by Sana M.' }))
    await waitFor(() => expect(sent).toEqual({ status: 'approved' }))
  })

  it('cannot reject without a reason, and sends the reason chosen', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(session(moderator, { 'GET /admin/reviews': () => page([reviewFixture()]), [`POST ${one}/moderation`]: ({ body }) => ((sent = body), json(200, reviewFixture({ status: 'rejected', rejectReason: body.reason }))) }))
    const { user } = renderApp('/reviews')
    await user.click(await screen.findByRole('button', { name: 'Reject the review by Sana M.' }))
    const dialog = await screen.findByRole('dialog')
    const reject = within(dialog).getByRole('button', { name: 'Reject' })
    expect(reject.hasAttribute('disabled')).toBe(true)
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /Reason/ }), 'personal_data')
    await user.type(within(dialog).getByRole('textbox', { name: /Note/ }), 'Phone number in the text')
    await user.click(reject)
    await waitFor(() => expect(sent).toEqual({ status: 'rejected', reason: 'personal_data', note: 'Phone number in the text' }))
  })

  it('approves and rejects a selection through the bulk call, and a rejection asks for its reason first', async () => {
    /** @type {any[]} */
    const sent = []
    fakeApi(
      session(moderator, {
        'GET /admin/reviews': () => page([reviewFixture(), reviewFixture({ id: ids.r2, displayName: 'Ali K.' })]),
        'POST /admin/reviews/bulk': ({ body }) => (sent.push(body), json(200, { succeeded: body.ids, failed: [] })),
      }),
    )
    const { user } = renderApp('/reviews')
    await screen.findAllByRole('img', { name: '5 out of 5 stars' })
    await user.click(screen.getByRole('checkbox', { name: 'Select this page' }))
    await user.click(await screen.findByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(sent[0]).toEqual({ ids: [ids.r1, ids.r2], action: 'approve' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select this page' }))
    await user.click(await screen.findByRole('button', { name: 'Reject' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('textbox', { name: /Note/ })).toBeNull() // the bulk call has no note
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /Reason/ }), 'spam')
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
    await waitFor(() => expect(sent[1]).toEqual({ ids: [ids.r1, ids.r2], action: 'reject', reason: 'spam' }))
  })

  it('a reader sees the queue with no decision buttons and no selection', async () => {
    fakeApi(session(reader, { 'GET /admin/reviews': () => page([reviewFixture()]) }))
    renderApp('/reviews')
    await screen.findByRole('img', { name: '5 out of 5 stars' })
    expect(screen.queryByRole('button', { name: /^Approve the review/ })).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})

describe('review drawer (plan/07-admin/08-reviews.md section 3)', () => {
  const open = `/reviews?review=${ids.r1}`
  /** @param {Record<string, (r: { body: any; headers: Headers; url: URL }) => Response>} [more] */
  const withReview = (more = {}) => session(moderator, { 'GET /admin/reviews': () => page([reviewFixture()]), [`GET ${one}`]: () => json(200, reviewFixture()), ...more })

  it('shows the whole review with its photos and links, and the guideline about rejecting', async () => {
    fakeApi(withReview())
    renderApp(open)
    const drawer = await screen.findByRole('dialog', { name: 'Review' })
    expect(await within(drawer).findByText(/The fabric is soft/)).toBeTruthy()
    expect(within(drawer).getAllByRole('img', { name: 'Photo from the customer' })).toHaveLength(2)
    expect(within(drawer).getByText(/Reject only for the listed reasons/)).toBeTruthy()
  })

  it('removes one photo after a confirmation, then approves', async () => {
    /** @type {string[]} */
    const calls = []
    fakeApi(
      withReview({
        [`DELETE ${one}/photos/${ids.photo1}`]: () => (calls.push('remove'), json(200, reviewFixture({ photos: [photo(ids.photo2)] }))),
        [`POST ${one}/moderation`]: ({ body }) => (calls.push(`moderate ${body.status}`), json(200, reviewFixture({ status: 'approved', photos: [photo(ids.photo2)] }))),
      }),
    )
    const { user } = renderApp(open)
    const drawer = await screen.findByRole('dialog', { name: 'Review' })
    await user.click((await within(drawer).findAllByRole('button', { name: 'Remove' }))[0] ?? drawer)
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove photo' }))
    await waitFor(() => expect(calls).toEqual(['remove']))
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: 'Review' })).getAllByRole('img', { name: 'Photo from the customer' })).toHaveLength(1))
    await user.click(within(screen.getByRole('dialog', { name: 'Review' })).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(calls).toEqual(['remove', 'moderate approved']))
  })

  it('saves a store reply, and an emptied reply removes it', async () => {
    /** @type {any[]} */
    const sent = []
    fakeApi(withReview({ [`PUT ${one}/reply`]: ({ body }) => (sent.push(body), json(200, reviewFixture(body.body ? { reply: { body: body.body, at: '2026-10-06T10:00:00.000Z' } } : {}))) }))
    const { user } = renderApp(open)
    const drawer = await screen.findByRole('dialog', { name: 'Review' })
    const box = await within(drawer).findByRole('textbox', { name: /Public reply/ })
    expect(within(drawer).getByRole('button', { name: 'Save reply' }).hasAttribute('disabled')).toBe(true) // nothing written yet
    await user.type(box, 'Thank you, Sana!')
    await user.click(within(drawer).getByRole('button', { name: 'Save reply' }))
    await waitFor(() => expect(sent[0]).toEqual({ body: 'Thank you, Sana!' }))
    await user.clear(box)
    await user.click(await within(drawer).findByRole('button', { name: 'Remove reply' })) // the saved reply is emptied
    await waitFor(() => expect(sent[1]).toEqual({ body: '' }))
  })

  it('an approved review can be rejected later, and offers no second approval', async () => {
    /** @type {any} */
    let sent = null
    fakeApi(withReview({ [`GET ${one}`]: () => json(200, reviewFixture({ status: 'approved' })), [`POST ${one}/moderation`]: ({ body }) => ((sent = body), json(200, reviewFixture({ status: 'rejected' }))) }))
    const { user } = renderApp(open)
    const drawer = await screen.findByRole('dialog', { name: 'Review' })
    await within(drawer).findByText(/The fabric is soft/)
    expect(within(drawer).queryByRole('button', { name: 'Approve' })).toBeNull()
    await user.click(within(drawer).getByRole('button', { name: 'Reject' }))
    const dialog = await screen.findByRole('dialog', { name: 'Reject this review' })
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /Reason/ }), 'offensive')
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
    await waitFor(() => expect(sent).toEqual({ status: 'rejected', reason: 'offensive' }))
  })

  it('a reader sees the review and the reply but cannot decide, reply or remove a photo', async () => {
    fakeApi({ ...withReview({ [`GET ${one}`]: () => json(200, reviewFixture({ reply: { body: 'Thank you!', at: '2026-10-06T10:00:00.000Z' } })) }), 'GET /admin/me': () => json(200, me({ permissions: reader })) })
    renderApp(open)
    const drawer = await screen.findByRole('dialog', { name: 'Review' })
    await within(drawer).findByText(/The fabric is soft/)
    expect(within(drawer).getByText('Thank you!')).toBeTruthy()
    expect(within(drawer).queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(within(drawer).queryByRole('button', { name: 'Remove' })).toBeNull()
    expect(within(drawer).queryByRole('textbox')).toBeNull()
  })

  it('says so when the review is gone', async () => {
    fakeApi(withReview({ [`GET ${one}`]: () => problem(404, 'not_found') }))
    renderApp(open)
    expect(await screen.findByText('This review is gone')).toBeTruthy()
  })
})

describe('reviews in the menu (plan/07-admin/08-reviews.md section 1)', () => {
  it('has Reviews with the number waiting while the store has reviews on', async () => {
    fakeApi(session(moderator, { 'GET /admin/reviews': () => page([]) }))
    renderApp('/reviews')
    const link = await screen.findByRole('link', { name: /Reviews/ })
    await waitFor(() => expect(within(link).getByText('2')).toBeTruthy())
  })

  it('has no Reviews in the menu, and the page is not found, when the store has reviews off', async () => {
    fakeApi(session(moderator, { 'GET /admin/nav/counts': () => json(200, {}) }))
    renderApp('/reviews')
    expect(await screen.findByText('Page not found')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Reviews/ })).toBeNull()
  })
})
