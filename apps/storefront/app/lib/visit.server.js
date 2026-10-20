// Counting visits (plan/17-owner-requests-2026-10.md section 6): a random number in the shop's own cookie says "this browser again", and nothing else is kept (no address, no browser
// name). A browser that asks not to be tracked, and a program that is not a person, are not counted. Never imported by browser code.
import { randomBytes } from 'node:crypto'
import { api } from './api.server'
import { cookieValue } from './cart.server'
import { cookieSecure } from './env.server'

export const VISITOR_COOKIE = 'nc_vid'
const ONE_YEAR = 60 * 60 * 24 * 365
const VALID = /^[0-9a-f]{32}$/

/** The visitor's number if the cookie holds one that this shop made. @param {Request} request */
export const visitorOf = (request) => {
  const value = cookieValue(request.headers.get('cookie'), VISITOR_COOKIE)
  return value && VALID.test(value) ? value : undefined
}

export const newVisitor = () => randomBytes(16).toString('hex')

/** Set again on every visit, so the year runs from the last one. @param {string} id */
export const visitorCookie = (id) => `${VISITOR_COOKIE}=${id}; Path=/; Max-Age=${ONE_YEAR}; HttpOnly; SameSite=Lax${cookieSecure()}`

/** Global Privacy Control and Do Not Track: both mean "do not follow me". @param {Request} request */
export const refusesTracking = (request) => request.headers.get('sec-gpc') === '1' || request.headers.get('dnt') === '1'

/** Search engines, link previews and speed tests. @param {Request} request */
export const isRobot = (request) => /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit/i.test(request.headers.get('user-agent') ?? '')

/** This browser placed the order behind this link: its visits belong to that customer from now on. Never in the way of the order. @param {Request} request @param {string} orderToken */
export async function linkVisitor(request, orderToken) {
  const visitor = visitorOf(request)
  if (!visitor) return
  await api('visits.link', { body: { visitor, order: orderToken } }).catch(() => undefined)
}
