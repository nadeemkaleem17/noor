// Every field staff can edit has a decided place on the shop (plan/06-storefront/12-admin-coverage.md, rule 2).
// Reads the real schemas, so a field added to the admin without a line in admin-coverage.map.js fails here.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { CategoryInput, HomeContent, StoreSettings, ThemeTokens } from '@noor/contract'
import { describe, expect, it } from 'vitest'
import { categoryInput, homeContent, isUrdu, storeSettings, themeTokens } from './admin-coverage.map.js'

const root = path.resolve(import.meta.dirname, '../../..')
/** @type {string[]} */
const sources = []
/** @param {string} dir */
function collect(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!['node_modules', 'build', 'dist', 'test', '.react-router'].includes(e.name)) collect(p)
    } else if (/\.(jsx?|css)$/.test(e.name) && !/\.test\./.test(e.name)) sources.push(readFileSync(p, 'utf8'))
  }
}
collect(path.join(root, 'apps/storefront/app'))
collect(path.join(root, 'packages/ui/src'))
const corpus = sources.join('\n')
/** A whole-word match ("policies.returns" is not found inside "policies.returnsDays"). @param {string} needle */
const reads = (needle) => new RegExp(`(^|[^\\w$])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w$])`).test(corpus)

/** The leaf paths of a zod 4 schema: "a.b", "list[].x", "list[]" for a list of plain values. @param {any} schema @param {string} [prefix] @param {string[]} [out] */
function walk(schema, prefix = '', out = []) {
  let s = schema
  for (let i = 0; i < 6; i++) {
    const t = s?.def?.type
    if (['optional', 'nullable', 'default', 'readonly', 'catch', 'prefault'].includes(t)) s = s.def.innerType
    else if (t === 'pipe') s = s.def.in
    else break
  }
  const t = s?.def?.type
  if (t === 'object') for (const [k, v] of Object.entries(s.shape)) walk(v, prefix ? `${prefix}.${k}` : k, out)
  else if (t === 'array') walk(s.def.element, `${prefix}[]`, out)
  else if (t === 'record') out.push(`${prefix}{}`)
  else out.push(prefix)
  return out
}

const surfaces = /** @type {const} */ ([
  ['StoreSettings', StoreSettings, storeSettings],
  ['HomeContent', HomeContent, homeContent],
  ['ThemeTokens', ThemeTokens, themeTokens],
  ['CategoryInput', CategoryInput, categoryInput],
])

describe.each(surfaces)('%s', (name, schema, map) => {
  const paths = walk(schema).filter((p) => !isUrdu(p))

  it('has a decided place on the shop for every field', () => {
    const missing = paths.filter((p) => !(p in map))
    expect(missing, `fields of ${name} with no line in admin-coverage.map.js`).toEqual([])
    const stale = Object.keys(map).filter((p) => !paths.includes(p) && !p.startsWith('i18n.'))
    expect(stale, `lines of ${name} for fields that no longer exist`).toEqual([])
  })

  it('shown and partly fields are read by the shop; not-shown fields are not', () => {
    const wrong = []
    for (const [p, [status, needle, note]] of Object.entries(map)) {
      if (status === 'staff-only') continue
      if (!needle) wrong.push(`${p}: no needle`)
      else if (status === 'not-shown' && reads(needle)) wrong.push(`${p}: the shop now reads "${needle}": change the line to shown`)
      else if (status !== 'not-shown' && !reads(needle)) wrong.push(`${p}: the shop never reads "${needle}"`)
      if ((status === 'partly' || status === 'not-shown') && !note) wrong.push(`${p}: ${status} needs a note naming the task`)
    }
    expect(wrong).toEqual([])
  })
})

it('counts the dead controls, so the number only goes down', () => {
  const dead = surfaces.flatMap(([, , map]) => Object.entries(map).filter(([, v]) => v[0] === 'not-shown').map(([p]) => p))
  // 8 after M8-02 (was 11 on 2026-10-16). Each M8 task that fixes one lowers this number in the same change.
  expect(dead.length).toBeLessThanOrEqual(8)
})
