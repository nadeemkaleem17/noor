// The bundle budget of DOC-06.10 section 2: gzip bytes of the JavaScript each kind of page loads before it can be used (the entry, the root, the page's own route and everything those import
// statically; chunks loaded on first use are not counted), and of the one CSS file. Run after `pnpm build`; exits 1 over budget. `--json` prints the numbers for a report.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const client = path.resolve(import.meta.dirname, '../build/client')
const file = readdirSync(path.join(client, 'assets')).find((f) => /^manifest-.*\.js$/.test(f))
if (!file) throw new Error('no build: run `pnpm --filter @noor/storefront build` first')
const text = readFileSync(path.join(client, 'assets', file), 'utf8')
const manifest = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))

const gz = (/** @type {string} */ url) => gzipSync(readFileSync(path.join(client, url.replace(/^\//, '')))).length
const kb = (/** @type {number} */ n) => Math.round(n / 100) / 10

/** the pages the budget table names, by the route that serves them (ceilings in kB: DOC-06.10 section 2 gives the first build's numbers and the targets they are to come down to) */
const pages = [
  { name: 'Home', route: 'home', js: 300 },
  { name: 'PLP', route: 'category', js: 305 },
  { name: 'PDP', route: 'product', js: 320 },
  { name: 'Cart', route: 'cart', js: 295 },
  { name: 'Checkout', route: 'checkout', js: 310 },
]
const cssBudget = 25

/** @param {string} id the route and its parents, root first */
const chain = (id) => {
  /** @type {string[]} */
  const ids = []
  for (let r = manifest.routes[id]; r; r = manifest.routes[r.parentId]) ids.unshift(r.id)
  return ids
}

const rows = pages.map((p) => {
  const urls = new Set([manifest.entry.module, ...manifest.entry.imports])
  const css = new Set()
  for (const id of chain(p.route)) {
    const r = manifest.routes[id]
    urls.add(r.module)
    for (const u of r.imports ?? []) urls.add(u)
    for (const u of r.css ?? []) css.add(u)
  }
  const js = [...urls].reduce((n, u) => n + gz(u), 0)
  const styles = [...css].reduce((n, u) => n + gz(u), 0)
  return { ...p, bytes: js, kb: kb(js), cssKb: kb(styles), over: kb(js) > p.js || kb(styles) > cssBudget }
})

if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2))
else {
  for (const r of rows) console.log(`${r.over ? 'OVER ' : 'ok   '}${r.name.padEnd(9)} JS ${String(r.kb).padStart(6)} kB of ${r.js}   CSS ${r.cssKb} kB of ${cssBudget}`)
}
process.exit(rows.some((r) => r.over) ? 1 : 0)
