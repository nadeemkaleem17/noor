// ADR-0002: the admin migrates to TypeScript file by file, and the TypeScript share of apps/admin/src must never go down.
//   pnpm ts-ratio            fail if the share (by lines) is below the committed baseline
//   pnpm ts-ratio --update   write the current share as the new baseline (use after a migration PR)
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'apps/admin/src')
const baselineFile = path.join(root, 'scripts/ts-ratio.baseline.json')

function lines(dir) {
  let ts = 0
  let js = 0
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules') continue
      const r = lines(p)
      ts += r.ts
      js += r.js
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) ts += readFileSync(p, 'utf8').split('\n').length
    else if (/\.(js|jsx)$/.test(name)) js += readFileSync(p, 'utf8').split('\n').length
  }
  return { ts, js }
}

const { ts, js } = lines(src)
const share = ts + js === 0 ? 1 : ts / (ts + js)
const pct = (n) => (n * 100).toFixed(1) + '%'

if (process.argv.includes('--update')) {
  writeFileSync(baselineFile, JSON.stringify({ share: Number(share.toFixed(4)) }, null, 2) + '\n')
  console.log(`baseline set to ${pct(share)}`)
} else {
  const baseline = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, 'utf8')).share : 0
  console.log(`apps/admin/src TypeScript share: ${pct(share)} (baseline ${pct(baseline)})`)
  if (share + 0.00005 < baseline) {
    console.error('The TypeScript share went down. Migrating a file must not be undone (ADR-0002).')
    process.exit(1)
  }
}
