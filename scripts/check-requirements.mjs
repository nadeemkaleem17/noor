// The function list of the storefront (plan/06-storefront/14-site-blueprint.md) against the tests.
//   node scripts/check-requirements.mjs                 checks the list is consistent (ids unique, the counts table matches the rows) and that every
//                                                       `REQ: XX-00` tag in a test names a real function; prints how many Must functions have a test
//   node scripts/check-requirements.mjs --list          also lists the Must functions that have no test yet
//   node scripts/check-requirements.mjs --require-built also fails when any Must function has no test (the closing check of M8-10)
// A test claims a function with a comment such as `// REQ: PD-06, SR-01` anywhere in the file.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const doc = readFileSync(path.join(root, 'plan/06-storefront/14-site-blueprint.md'), 'utf8')
const flags = new Set(process.argv.slice(2))
const problems = []

const rows = [...doc.matchAll(/^\| ([A-Z]{2})-(\d{2}) \| .*? \| (M|S|L) \| (Y|P|N) \|/gm)].map((m) => ({ id: `${m[1]}-${m[2]}`, area: m[1], pri: m[3], today: m[4] }))
const ids = new Set()
for (const r of rows) if (ids.has(r.id)) problems.push(`duplicate id ${r.id}`)
else ids.add(r.id)

// the counts table: "| Shell SH | 14 | 3 | 0 |" (an area line may name several codes)
const counted = { M: 0, S: 0, L: 0 }
for (const m of doc.matchAll(/^\| ([^|]*?) \| (\d+) \| (\d+) \| (\d+) \|$/gm)) {
  const codes = m[1].match(/\b[A-Z]{2}\b/g) ?? []
  if (!codes.length) continue
  const have = { M: 0, S: 0, L: 0 }
  for (const r of rows) if (codes.includes(r.area)) have[r.pri]++
  const said = { M: Number(m[2]), S: Number(m[3]), L: Number(m[4]) }
  for (const p of ['M', 'S', 'L']) if (have[p] !== said[p]) problems.push(`counts table, "${m[1].trim()}": ${p} says ${said[p]}, the rows say ${have[p]}`)
  for (const p of ['M', 'S', 'L']) counted[p] += said[p]
}
const total = { M: 0, S: 0, L: 0 }
for (const r of rows) total[r.pri]++
for (const p of ['M', 'S', 'L']) if (counted[p] !== total[p]) problems.push(`counts table adds up to ${counted[p]} ${p} rows, the list has ${total[p]}`)

// REQ tags in tests
const tagged = new Set()
/** @param {string} dir */
function scan(dir) {
  let entries = []
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!['node_modules', 'build', 'dist', '.react-router'].includes(e.name)) scan(p)
    } else if (/\.(test|spec)\.[cm]?jsx?$/.test(e.name)) {
      const text = readFileSync(p, 'utf8')
      for (const tag of text.matchAll(/REQ:\s*((?:[A-Z]{2}-\d{2}[\s,]*)+)/g)) {
        for (const id of tag[1].match(/[A-Z]{2}-\d{2}/g) ?? []) {
          if (!ids.has(id)) problems.push(`${path.relative(root, p)}: REQ tag ${id} is not a function of the list`)
          else tagged.add(id)
        }
      }
    }
  }
}
for (const d of ['apps/storefront/test', 'apps/e2e/tests', 'apps/e2e/screen-reader', 'packages/ui/test', 'packages/i18n/test']) scan(path.join(root, d))

const must = rows.filter((r) => r.pri === 'M')
const untested = must.filter((r) => !tagged.has(r.id))
console.log(`${rows.length} functions: ${total.M} must, ${total.S} should, ${total.L} later; ${must.length - untested.length} of ${must.length} must functions have a test tagged with their id`)
if (flags.has('--list') && untested.length) console.log(`no test yet: ${untested.map((r) => r.id).join(' ')}`)
if (flags.has('--require-built') && untested.length) problems.push(`${untested.length} must functions have no test: ${untested.map((r) => r.id).join(' ')}`)
if (problems.length) {
  console.error(problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}
