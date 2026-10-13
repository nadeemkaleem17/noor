// Looks for what must never be committed (plan/11-security-auth.md sections 7 and 13): private keys, tokens of well-known services, an env file that is not an example,
// and the names of the old shared admin key (ADR-0012). A small stand-in for gitleaks, which needs a download; it knows few shapes, but those it knows it finds.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/** Shapes of credentials. Each is specific enough to have almost no false positives. */
export const shapes = [
  { name: 'a private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----/ },
  { name: 'an AWS access key id', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'a GitHub token', pattern: /\b(?:ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{50,}\b/ },
  { name: 'a Slack token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'a live Stripe key', pattern: /\b[sr]k_live_[A-Za-z0-9]{16,}/ },
  { name: 'a JSON web token', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'a password in a connection address', pattern: /\b(?:mysql|postgres(?:ql)?|mongodb(?:\+srv)?|redis|smtps?|amqp):\/\/[^\s:@/'"`$<>]+:(?!__)[^\s:@/'"`$<>]{6,}@(?!localhost\b|127\.0\.0\.1\b|h\b)[^\s'"`]+/ },
  { name: 'the old shared admin key', pattern: /VITE_ADMIN_KEY|\bdev-key\b/ },
]

/** Files that are not looked at: this scanner itself and its test (they name the shapes), the plan (it names the banned strings), the lock file. */
const skipped = [/^plan\//,/^pnpm-lock\.yaml$/, /^packages\/config\/secrets\.js$/, /^packages\/config\/test\/secrets\.test\.js$/, /\.(png|jpe?g|webp|avif|gif|ico|woff2?|zip|pdf)$/i]

/**
 * @param {string} file path relative to the repository root
 * @param {string} text
 * @returns {{ file: string, line: number, what: string }[]}
 */
export function scanText(file, text) {
  /** @type {{ file: string, line: number, what: string }[]} */
  const found = []
  if (/(^|\/)\.env(\.[^/]+)?$/.test(file) && !/\.example$/.test(file)) found.push({ file, line: 1, what: 'an env file that is not an example' })
  text.split('\n').forEach((line, i) => {
    for (const { name, pattern } of shapes) if (pattern.test(line)) found.push({ file, line: i + 1, what: name })
  })
  return found
}

/** Every tracked file of the repository. @param {string} root */
export function scan(root) {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean)
  /** @type {{ file: string, line: number, what: string }[]} */
  const found = []
  for (const file of files) {
    if (skipped.some((s) => s.test(file))) continue
    let text
    try {
      text = readFileSync(path.join(root, file), 'utf8')
    } catch {
      continue // deleted but not yet committed
    }
    found.push(...scanText(file, text))
  }
  return found
}
