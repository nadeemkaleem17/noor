// What one journey leaves for a later one (E2E-08 confirms and ships the order E2E-01 placed). Journeys run in file order, one at a time.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { dataDir } from '../env.mjs'

const file = path.join(dataDir, 'journeys.json')
const read = () => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {})

/** @param {string} key @param {unknown} value */
export const remember = (key, value) => writeFileSync(file, JSON.stringify({ ...read(), [key]: value }))

/** @param {string} key @returns {any} */
export const recall = (key) => {
  const value = read()[key]
  if (value === undefined) throw new Error(`"${key}" was not saved: the journey that makes it did not run or failed`)
  return value
}
