// Finds physical-direction styling (left/right) that breaks right-to-left layouts (plan/04-design-system/tokens.md section 10).
// Use ms-/me-/ps-/pe-/start-/end-/text-start/border-s/rounded-s instead. A line that must stay physical carries a
// `physical: <reason>` comment and is skipped.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const utility = [
  /(?<![\w-])(?:[a-z0-9]+:)*-?(?:ml|mr|pl|pr|left|right)-(?!\w*:)\S/, // ml-4, pr-2, left-0, -mr-1, md:ml-4
  /(?<![\w-])(?:[a-z0-9]+:)*(?:border-[lr]|rounded-[lr]|rounded-(?:tl|tr|bl|br)|text-left|text-right|float-left|float-right|clear-left|clear-right|scroll-m[lr]|scroll-p[lr])(?![a-z])/,
]
const css = [
  /(?:margin|padding)-(?:left|right)\s*:/,
  /border-(?:left|right)(?:-[a-z]+)?\s*:/,
  /border-(?:top|bottom)-(?:left|right)-radius\s*:/,
  /text-align\s*:\s*(?:left|right)/,
  /float\s*:\s*(?:left|right)/,
  /(?<![-\w])(?:left|right)\s*:/,
]

/** @returns {{ line: number, text: string }[]} */
export function findPhysical(source, file) {
  const patterns = file.endsWith('.css') ? css : [...utility, ...css]
  const hits = []
  source.split('\n').forEach((text, i) => {
    if (/physical:/.test(text)) return
    if (/^\s*(\/\/|\/\*|\*)/.test(text)) return // whole-line comment: prose such as "right-to-left" is not styling
    const code = text.replace(/\/\*.*?\*\//g, '').replace(/\s\/\/.*$/, '')
    if (patterns.some((re) => re.test(code))) hits.push({ line: i + 1, text: text.trim() })
  })
  return hits
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.turbo', 'storybook-static', 'test', 'tests', '__tests__'])

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) yield* walk(p)
    } else yield p
  }
}

/** Scans TypeScript and CSS files under `dirs` (relative to `root`). Old JSX/JS files are not scanned: they migrate file by file (ADR-0002). */
export function scan(root, dirs) {
  const found = []
  for (const d of dirs) {
    const abs = path.join(root, d)
    try { statSync(abs) } catch { continue }
    for (const file of walk(abs)) {
      if (!/\.(ts|tsx|css)$/.test(file) || /\.(test|spec)\./.test(file) || file.endsWith('.d.ts')) continue
      for (const h of findPhysical(readFileSync(file, 'utf8'), file)) found.push({ file: path.relative(root, file), ...h })
    }
  }
  return found
}
