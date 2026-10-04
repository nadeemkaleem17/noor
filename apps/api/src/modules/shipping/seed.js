// The part of the base seed that belongs to shipping (plan/09-data-model/09 sections 4.1 and 4.5): the city list and the couriers.
// Idempotent: it adds what is missing and never changes what staff edited. Zones are not seeded; the owner defines them (the demo seed adds some).
import { now } from '../../platform/clock.js'
import { uuidv7 } from '../../platform/ids.js'
import { citySeeds } from './cities.js'
import * as repo from './repository.js'

/** Tracking URL patterns stay empty until checked against each courier's own site (DOC-09.9 Q-09.9-3). */
const courierSeeds = [
  { name: 'TCS', trackingRequired: true },
  { name: 'Leopards', trackingRequired: true },
  { name: 'M&P', trackingRequired: true },
  { name: 'Trax', trackingRequired: true },
  { name: 'PostEx', trackingRequired: true },
  { name: 'Own rider', trackingRequired: false },
]

/** @param {import('../../platform/db.js').Executor} db */
export async function seedShipping(db) {
  const haveCities = await repo.cityNames(db)
  const at = now()
  const newCities = citySeeds.filter((c) => !haveCities.has(c.name.toLowerCase()))
  for (let i = 0; i < newCities.length; i += 100) {
    await repo.insertCities(db, newCities.slice(i, i + 100).map((c) => ({ id: uuidv7(), name: c.name, province: c.province, aliases: c.aliases, isMajor: c.isMajor, createdAt: at })))
  }
  const haveCouriers = await repo.courierNames(db)
  const newCouriers = courierSeeds.map((c, i) => ({ ...c, sortOrder: i })).filter((c) => !haveCouriers.has(c.name))
  if (newCouriers.length) await repo.insertCouriers(db, newCouriers.map((c) => ({ id: uuidv7(), name: c.name, trackingUrlPattern: null, trackingRequired: c.trackingRequired, enabled: true, sortOrder: c.sortOrder })))
  return { cities: newCities.length, couriers: newCouriers.length }
}
