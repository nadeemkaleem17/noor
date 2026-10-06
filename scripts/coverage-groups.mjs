// Prints line and branch coverage per floor group of plan/13-quality.md section 5, from a Vitest `json-summary` report, and exits 1 when a group is under its floor.
// Usage: pnpm --filter @noor/api test:coverage   (runs the suite with coverage, then this script)
//
// Lines are held to the plan's floors. Branches are held to the level measured at M4-12 (a ratchet: raise it as tests are added, never lower it); the plan's own
// branch floors (95% and 100%) are shown beside them. The distance between the two is known test debt, listed in plan/13-quality.md section 13.
import { readFileSync } from 'node:fs'

const file = process.argv[2] ?? '.data/cov/coverage-summary.json'
const report = JSON.parse(readFileSync(file, 'utf8'))

const groups = [
  { name: 'cart pricing and customisation, promotions', lines: 100, branches: 91, plan: 100, match: /modules\/(cart\/(pricing|customization)\.js|promotions\/)/ },
  { name: 'orders service and transitions', lines: 95, branches: 86, plan: 95, match: /modules\/orders\/(service|transitions)\.js/ },
  { name: 'inventory', lines: 95, branches: 84, plan: 95, match: /modules\/inventory\// },
  { name: 'payments', lines: 95, branches: 82, plan: 95, match: /modules\/payments\// },
  { name: 'auth', lines: 95, branches: 85, plan: 95, match: /modules\/auth\// },
]

let failed = false
for (const g of groups) {
  let lines = 0
  let linesHit = 0
  let branches = 0
  let branchesHit = 0
  /** @type {string[]} */
  const gaps = []
  for (const [f, v] of Object.entries(report)) {
    const name = f.replaceAll('\\', '/')
    if (f === 'total' || !g.match.test(name)) continue
    lines += v.lines.total
    linesHit += v.lines.covered
    branches += v.branches.total
    branchesHit += v.branches.covered
    if (v.lines.pct < 100 || v.branches.pct < 100) gaps.push(`${name.replace(/.*modules\//, '')}: ${v.lines.pct}% lines, ${v.branches.pct}% branches`)
  }
  const l = lines ? (100 * linesHit) / lines : 100
  const b = branches ? (100 * branchesHit) / branches : 100
  const ok = l >= g.lines && b >= g.branches
  if (!ok) failed = true
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${g.name.padEnd(44)} lines ${l.toFixed(1).padStart(5)} (floor ${g.lines})  branches ${b.toFixed(1).padStart(5)} (floor ${g.branches}, plan ${g.plan})`)
  if (!ok) for (const gap of gaps) console.log(`       ${gap}`)
}
process.exit(failed ? 1 : 0)
