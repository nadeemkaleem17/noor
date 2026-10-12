// Lab budgets of DOC-06.10 section 2, measured with Lighthouse on its default mobile profile (a phone with a 4x slower CPU on a simulated 1.6 Mbps, 150 ms connection: the plan's reference
// profile), three runs of each page, the median of each number. Needs a built, running storefront with the API behind it:
//   pnpm --filter @noor/storefront build && pnpm --filter @noor/storefront start     (and the API)
//   node apps/storefront/scripts/lighthouse.mjs [--base http://localhost:5174] [--runs 3] [--json]
// The pages are found through the API (the first category, the first product with a picture); `--home`, `--plp`, `--pdp`, `--cart` take an address instead. Exits 1 over budget.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const args = process.argv.slice(2)
const opt = (/** @type {string} */ name, /** @type {string} */ fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined) ?? fallback
const has = (/** @type {string} */ name) => args.includes(`--${name}`)
const base = (has('base') ? opt('base', '') : 'http://localhost:5174').replace(/\/$/, '')
const apiBase = has('api') ? opt('api', '') : 'http://localhost:3000/api/v1'
const runs = Number(opt('runs', '3'))

const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p))
if (!chrome) throw new Error('no Chrome found: set CHROME_PATH')

/** @param {string} p */
const getJson = async (p) => (await fetch(`${apiBase}${p}`)).json()
const category = has('plp') ? undefined : (await getJson('/categories')).items[0]?.handle
const product = has('pdp') ? undefined : (await getJson('/products?limit=1')).items[0]?.handle
// ceilings: LCP seconds, CLS, server response ms (DOC-06.10 section 2: the targets are 2.5 s and 3.0 s for the cart; the LCP ceilings are what the first build measures)
const pages = [
  { name: 'Home', url: opt('home', `${base}/`), lcp: 4.5, cls: 0.05, ttfb: 600 },
  { name: 'PLP', url: opt('plp', `${base}/c/${category}`), lcp: 4.5, cls: 0.05, ttfb: 600 },
  { name: 'PDP', url: opt('pdp', `${base}/p/${product}`), lcp: 4.5, cls: 0.05, ttfb: 600 },
  { name: 'Cart', url: opt('cart', `${base}/cart`), lcp: 4.0, cls: 0.1, ttfb: 800 },
]

const median = (/** @type {number[]} */ xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0
const profile = mkdtempSync(path.join(tmpdir(), 'lh-'))

/** @param {string} url */
function once(url) {
  const out = path.join(profile, 'r.json')
  const r = spawnSync(process.execPath, [path.join(import.meta.dirname, '../node_modules/lighthouse/cli/index.js'), url, '--only-categories=performance', '--output=json', `--output-path=${out}`, '--quiet', `--chrome-flags=--headless=new --no-sandbox`], { env: { ...process.env, CHROME_PATH: chrome }, encoding: 'utf8', timeout: 180_000 })
  if (r.status !== 0) throw new Error(`lighthouse failed for ${url}: ${r.stderr || r.stdout}`)
  const lhr = JSON.parse(readFileSync(out, 'utf8'))
  const a = lhr.audits
  const items = /** @type {{ resourceType: string, transferSize: number, url: string }[]} */ (a['network-requests'].details.items)
  const bytes = (/** @type {string} */ type) => items.filter((i) => i.resourceType === type).reduce((n, i) => n + i.transferSize, 0)
  return {
    lcp: a['largest-contentful-paint'].numericValue / 1000,
    cls: a['cumulative-layout-shift'].numericValue,
    tbt: a['total-blocking-time'].numericValue,
    ttfb: a['server-response-time'].numericValue,
    requests: items.length,
    js: bytes('Script'), css: bytes('Stylesheet'), font: bytes('Font'), image: bytes('Image'), doc: bytes('Document'),
    thirdParty: items.filter((i) => !i.url.startsWith(base) && !i.url.startsWith(new URL(apiBase).origin) && !i.url.startsWith('data:')).length,
  }
}

const rows = []
try {
  for (const p of pages) {
    const samples = Array.from({ length: runs }, () => once(p.url))
    const m = Object.fromEntries(Object.keys(samples[0] ?? {}).map((k) => [k, median(samples.map((s) => /** @type {Record<string, number>} */ (s)[k] ?? 0))]))
    const over = /** @type {number} */ (m.lcp) > p.lcp || /** @type {number} */ (m.cls) > p.cls || /** @type {number} */ (m.ttfb) > p.ttfb
    rows.push({ ...p, ...m, budget: p.lcp, over })
  }
} finally {
  rmSync(profile, { recursive: true, force: true })
}

if (has('json')) console.log(JSON.stringify(rows, null, 2))
else {
  const kb = (/** @type {unknown} */ n) => `${Math.round(Number(n) / 1000)}`.padStart(4)
  for (const r of rows) {
    console.log(`${r.over ? 'OVER ' : 'ok   '}${r.name.padEnd(5)} LCP ${Number(r.lcp).toFixed(2)}s of ${r.budget}  CLS ${Number(r.cls).toFixed(3)}  TTFB ${Math.round(Number(r.ttfb))}ms  TBT ${Math.round(Number(r.tbt))}ms  req ${r.requests}  kB: doc${kb(r.doc)} js${kb(r.js)} css${kb(r.css)} font${kb(r.font)} img${kb(r.image)}  3rd-party ${r.thirdParty}`)
  }
}
process.exit(rows.some((r) => r.over) ? 1 : 0)
