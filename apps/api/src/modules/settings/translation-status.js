// How much of the interface exists in Urdu, for the "enable Urdu" switch (plan/10-api/07 section 2). Counts the strings of the
// catalogs in @noor/i18n; products are counted when the catalog module exists (their translations live on the product rows).
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const localesDir = fileURLToPath(new URL('../locales/', import.meta.resolve('@noor/i18n')))

/** Every text in a catalog, by dotted key. @param {unknown} node @param {string} prefix @param {Map<string, string>} out */
function flatten(node, prefix, out) {
  if (typeof node === 'string') out.set(prefix, node)
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) flatten(v, prefix ? `${prefix}.${k}` : k, out)
  return out
}

/** @param {string} locale */
const strings = (locale) => {
  const out = new Map()
  const dir = `${localesDir}${locale}/`
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) flatten(JSON.parse(readFileSync(`${dir}${file}`, 'utf8')), file.replace(/\.json$/, ''), out)
  return out
}

export async function translationStatus() {
  const en = strings('en')
  const ur = strings('ur')
  return {
    ui: { total: en.size, translated: [...en.keys()].filter((k) => (ur.get(k) ?? '').trim() !== '').length },
    products: { total: 0, translated: 0 },
  }
}
