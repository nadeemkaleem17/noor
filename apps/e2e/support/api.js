// The API as set-up for a journey: what a journey needs to exist before the part it is testing (a promo code, a stock count) is made through
// the API as the owner, so the journey itself spends its time on the screens it is about. Never used for what a journey asserts.
import { request } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { dataDir, urls } from '../env.mjs'

/** @param {string} [who] a key of `staff` that has a saved sign-in (see global-setup.js) */
export async function adminApi(who = 'owner') {
  // the session cookie is `Secure`: a request context does not send those over plain http, so it is sent by hand (a browser would, for 127.0.0.1)
  const { cookies } = JSON.parse(readFileSync(path.join(dataDir, `${who}.json`), 'utf8'))
  const cookie = cookies.map((/** @type {{ name: string, value: string }} */ c) => `${c.name}=${c.value}`).join('; ')
  const ctx = await request.newContext({ baseURL: urls.api, extraHTTPHeaders: { origin: urls.admin, cookie } })
  const me = await (await ctx.get('/api/v1/admin/me')).json()
  const headers = { 'x-csrf-token': me.csrfToken }
  /** @param {import('@playwright/test').APIResponse} res */
  const read = async (res) => {
    const text = await res.text()
    if (!res.ok()) throw new Error(`${res.url()} answered ${res.status()}: ${text}`)
    return text ? JSON.parse(text) : undefined
  }
  return {
    /** @param {string} url */
    get: async (url) => read(await ctx.get(`/api/v1${url}`)),
    /** @param {string} url @param {unknown} [data] */
    post: async (url, data) => read(await ctx.post(`/api/v1${url}`, { headers, data })),
    /** @param {string} url @param {unknown} data */
    put: async (url, data) => read(await ctx.put(`/api/v1${url}`, { headers, data })),
    /** @param {string} url */
    delete: async (url) => read(await ctx.delete(`/api/v1${url}`, { headers })),
    dispose: () => ctx.dispose(),
  }
}

/** The public product with its variants, as a customer's page gets it. @param {string} handle */
export async function publicProduct(handle) {
  const ctx = await request.newContext({ baseURL: urls.api })
  try {
    const res = await ctx.get(`/api/v1/products/${handle}`)
    return await res.json()
  } finally {
    await ctx.dispose()
  }
}

/** Makes exactly `available` units free to buy (on hand minus what open orders hold), so a journey can run again on the same database. @param {Awaited<ReturnType<typeof adminApi>>} api @param {string} variantId @param {number} available */
export async function setAvailable(api, variantId, available) {
  const adjust = (/** @type {'add' | 'remove'} */ mode, /** @type {number} */ quantity) => api.post('/admin/inventory/adjustments', { variantId, mode, quantity, reason: 'correction', note: 'journey set-up' })
  const now = await adjust('add', 0)
  const change = available - now.available
  return change === 0 ? now : adjust(change > 0 ? 'add' : 'remove', Math.abs(change))
}

/** A promo code for the whole shop. @param {Awaited<ReturnType<typeof adminApi>>} api @param {{ code: string, percent: number, minSpendRupees?: number }} p */
export const createPromo = (api, { code, percent, minSpendRupees }) =>
  api.post('/admin/promos', {
    code, type: 'percent', percent, scope: 'all', excludeSaleItems: false, firstOrderOnly: false, enabled: true,
    ...(minSpendRupees ? { minSpend: { amount: minSpendRupees * 100, currency: 'PKR' } } : {}),
  })
