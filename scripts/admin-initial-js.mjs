// The admin's initial JavaScript, gzipped (ADR-0015, amended at M7-09: at most 230 kB, measured 222.3 at sign-in and 227.5 at the dashboard; plan/13-quality.md section 6.4).
// Counts the entry chunk, everything it imports at load time, and the route chunk a first visit opens (default: login) with its own imports.
// Usage: node scripts/admin-initial-js.mjs [route-chunk-prefix]   (after `pnpm --filter @noor/admin build`)
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const dist = path.resolve(import.meta.dirname, '../apps/admin/dist')
const assets = path.join(dist, 'assets')
const route = process.argv[2] ?? 'login'
const BUDGET_KB = 230

const html = readFileSync(path.join(dist, 'index.html'), 'utf8')
const entry = /src="\/assets\/([^"]+\.js)"/.exec(html)?.[1]
if (!entry) throw new Error('no entry script in dist/index.html: build the admin first')
const routeChunk = readdirSync(assets).find((f) => new RegExp(`^${route}-[A-Za-z0-9_-]{8}\\.js$`).test(f))

const seen = new Map()
/** Follows static `import ... from "./x.js"` and `import "./x.js"`; dynamic `import("./x.js")` is not followed. @param {string} file */
function visit(file) {
  if (seen.has(file)) return
  const code = readFileSync(path.join(assets, file), 'utf8')
  seen.set(file, gzipSync(code).length)
  for (const m of code.matchAll(/(?:^|[;}\s])(?:import|export)\s*(?:[^'"()]*?from\s*)?["']\.\/([^"']+\.js)["']/g)) visit(/** @type {string} */ (m[1]))
}
visit(entry)
if (routeChunk) visit(routeChunk)

let total = 0
for (const [file, bytes] of [...seen].sort((a, b) => b[1] - a[1])) {
  total += bytes
  console.log(`${(bytes / 1024).toFixed(1).padStart(7)} kB  ${file}`)
}
const kb = total / 1024
console.log(`${kb.toFixed(1).padStart(7)} kB  total (gzip) for ${routeChunk ?? 'the entry only'}, budget ${BUDGET_KB} kB`)
if (kb > BUDGET_KB) process.exitCode = 1
