// Shared ESLint flat-config pieces (plan/03-frontend-architecture.md section 5.3, plan/15-conventions.md).
// Plain JS on purpose: a flat config written in TypeScript needs another loader.
import { readdirSync } from 'node:fs'
import path from 'node:path'
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Task markers in comments must carry a task id, e.g. (M2-031): see plan/15-conventions.md section 8.
const todoNeedsTaskId = {
  meta: { type: 'suggestion', messages: { bare: 'TODO needs a task id, e.g. TODO(M2-031): ...' }, schema: [] },
  create(context) {
    return {
      Program() {
        for (const c of context.sourceCode.getAllComments()) {
          if (/\bTODO\b(?!\([A-Z]+\d*-[\w-]+\))/.test(c.value)) context.report({ loc: c.loc, messageId: 'bare' })
        }
      },
    }
  },
}

/** JavaScript baseline for every workspace: types are JSDoc, checked by tsc --checkJs (ADR-0021). */
export const base = [
  { ignores: ['**/dist/**', '**/build/**', '**/.turbo/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { noor: { rules: { 'todo-needs-task-id': todoNeedsTaskId } } },
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true }],
      'no-restricted-syntax': ['error', { selector: "CallExpression[callee.property.name=/^(only|skip)$/][callee.object.name=/^(it|test|describe)$/]", message: 'No .only/.skip (plan/13-quality.md section 5).' }],
      'noor/todo-needs-task-id': 'error',
    },
  },
  // Tests may use non-null assertions (ADR-0002).
  { files: ['**/*.test.{js,jsx}'], rules: { '@typescript-eslint/no-non-null-assertion': 'off' } },
]

/** Only the API's config.js may read process.env (plan/08-backend-architecture.md section 12). */
export const noProcessEnv = [
  { files: ['**/*.{js,jsx}'], ignores: ['**/platform/config.js', '**/drizzle.config.js', '**/spikes/**'], rules: { 'no-restricted-properties': ['error', { object: 'process', property: 'env', message: 'Read configuration through platform/config.js.' }] } },
]

// ESLint flat config does not merge options of the same rule across entries: a later `no-restricted-imports`
// replaces an earlier one. So every path gets ONE complete list: the shared patterns plus its own.
const shared = [
  { group: ['@base-ui/*', '@radix-ui/*'], message: 'Import primitives only through @noor/ui.' },
  { group: ['zod', 'zod/*'], message: 'Import z and schemas from @noor/contract.' },
]
const restrict = (...extra) => ({ 'no-restricted-imports': ['error', { patterns: [...shared, ...extra] }] })

/**
 * Import boundaries for an app (plan/03-frontend-architecture.md section 5.3):
 * apps use @noor/ui and @noor/contract, never the primitives or zod directly; a feature never imports another
 * feature; components/ and lib/ never import features/ or app/.
 * `featuresDir` is relative to `cwd` (the app root, where ESLint runs).
 */
export const appRules = ({ alias = '@', featuresDir = 'src/features', cwd = process.cwd() } = {}) => [
  { files: ['**/*.{ts,tsx,js,jsx}'], rules: restrict() },
  {
    files: ['**/components/**', '**/lib/**'],
    rules: restrict({ group: ['**/features/*', '**/app/*'], message: 'components/ and lib/ may not import features/ or app/.' }),
  },
  ...readdirSync(path.join(cwd, featuresDir), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({
      files: [`${featuresDir}/${e.name}/**`],
      rules: restrict({
        group: [`${alias}/features/*`, `!${alias}/features/${e.name}`, `!${alias}/features/${e.name}/**`],
        message: 'Features do not import each other. Compose them in a route (plan/03-frontend-architecture.md section 5.3).',
      }),
    })),
]

/** Browser globals (`document`, `window`, `fetch`) for code that runs in a browser or jsdom: @noor/ui and the storefront. */
export const browser = [{ languageOptions: { globals: { ...globals.browser } } }]
