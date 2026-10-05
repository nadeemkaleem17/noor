// One fixture per rule: the forbidden code must fail, the allowed code must pass (M0-02 "done when").
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { ESLint } from 'eslint'
import { base, noProcessEnv, appRules } from '../eslint.js'

const root = mkdtempSync(path.join(tmpdir(), 'noor-eslint-'))
mkdirSync(path.join(root, 'src/features/cart'), { recursive: true })
mkdirSync(path.join(root, 'src/features/orders'), { recursive: true })
afterAll(() => rmSync(root, { recursive: true, force: true }))

const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: true,
  overrideConfig: [
    ...base,
    ...noProcessEnv,
    ...appRules({ cwd: root }),
  ],
})

const lint = async (file, code) => {
  const [r] = await eslint.lintText(code, { filePath: path.join(root, file) })
  return r.messages.map((m) => m.ruleId)
}

describe('shared ESLint config', () => {
  it('rejects a cross-feature import and allows the same feature', async () => {
    expect(await lint('src/features/cart/a.js', "import { x } from '@/features/orders/x'\nexport { x }")).toContain('no-restricted-imports')
    expect(await lint('src/features/cart/a.js', "import { x } from '@/features/cart/x'\nexport { x }")).not.toContain('no-restricted-imports')
  })

  it('rejects direct primitive and zod imports in apps', async () => {
    expect(await lint('src/a.js', "import * as D from '@base-ui/react'\nexport { D }")).toContain('no-restricted-imports')
    expect(await lint('src/a.js', "import { z } from 'zod'\nexport { z }")).toContain('no-restricted-imports')
  })

  it('allows the react-hook-form zod resolver, which the forms need', async () => {
    expect(await lint('src/a.js', "import { zodResolver } from '@hookform/resolvers/zod'\nexport { zodResolver }")).not.toContain('no-restricted-imports')
  })

  it('rejects features/ imports from lib/', async () => {
    expect(await lint('src/lib/a.js', "import { x } from '../features/cart/x'\nexport { x }")).toContain('no-restricted-imports')
  })

  it('rejects ts-ignore and an undescribed ts-expect-error (types are JSDoc, but tsc still reads these comments)', async () => {
    expect(await lint('src/a.js', '// @ts-ignore\nexport const a = 1')).toContain('@typescript-eslint/ban-ts-comment')
    expect(await lint('src/a.js', '// @ts-expect-error\nexport const a = 1')).toContain('@typescript-eslint/ban-ts-comment')
    expect(await lint('src/a.js', '// @ts-expect-error the schema is stricter than this call\nexport const a = 1')).not.toContain('@typescript-eslint/ban-ts-comment')
  })

  it('rejects process.env outside platform/config.js', async () => {
    expect(await lint('src/a.js', 'export const a = process.env.X')).toContain('no-restricted-properties')
    expect(await lint('src/platform/config.js', 'export const a = process.env.X')).not.toContain('no-restricted-properties')
  })

  it('requires a task id on TODO comments', async () => {
    expect(await lint('src/a.js', '// TODO fix later\nexport const a = 1')).toContain('noor/todo-needs-task-id')
    expect(await lint('src/a.js', '// TODO(M2-031): fix later\nexport const a = 1')).not.toContain('noor/todo-needs-task-id')
  })

  it('rejects .only in tests', async () => {
    expect(await lint('src/a.test.js', "const it = { only: () => {} }\nit.only('x', () => {})")).toContain('no-restricted-syntax')
  })
})
