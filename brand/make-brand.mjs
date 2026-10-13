// Draws the shop's logo files from the theme's own heading font (Playfair Display, SIL Open Font License) with the browser Playwright already has:
//   node brand/make-brand.mjs        (from the repo root; needs `pnpm install`)
// Writes brand/rubaya-wordmark.png (dark text, transparent: the logo to upload in Admin -> Settings -> Store -> Brand),
// brand/rubaya-wordmark-light.png (white text, for a dark header), the storefront's and the admin's favicon.svg, and the touch icons.
// The colours are the default theme's (`storefront-gold`: ink #141210, gold #C9A227). A real designer's logo replaces these files; nothing else depends on them.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { chromium } from '../apps/e2e/node_modules/@playwright/test/index.mjs'

const root = path.resolve(import.meta.dirname, '..')
const font = `data:font/woff2;base64,${readFileSync(path.join(root, 'node_modules/.pnpm/@fontsource-variable+playfair-display@5.3.0/node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2')).toString('base64')}` // inline: a page set from a string may not open a file address
const INK = '#141210'
const GOLD = '#C9A227'

/** The favicon: an ink square with a gold R. System serif is used here because a favicon file cannot load a web font; Playfair is drawn into the PNG icons below. */
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${INK}"/><text x="32" y="47" text-anchor="middle" font-family="'Playfair Display', Georgia, 'Times New Roman', serif" font-size="44" font-weight="700" fill="${GOLD}">R</text></svg>\n`

const page = (/** @type {string} */ body) => `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:'Playfair Display';src:url('${font}');font-weight:400 900}html,body{margin:0;background:transparent}</style>${body}`

const browser = await chromium.launch({ channel: 'chrome' }) // the Chrome on this machine, as the E2E suite uses
try {
  const ctx = await browser.newContext({ deviceScaleFactor: 3 })
  const p = await ctx.newPage()

  /** @param {string} color @param {string} file */
  const wordmark = async (color, file) => {
    await p.setContent(page(`<span id="w" style="display:inline-block;padding:6px 4px;font:600 36px/1.1 'Playfair Display';letter-spacing:.04em;color:${color}">Rubaya</span>`))
    await p.evaluate(() => document.fonts.ready)
    await p.locator('#w').screenshot({ path: file, omitBackground: true })
  }
  mkdirSync(path.join(root, 'brand'), { recursive: true })
  await wordmark(INK, path.join(root, 'brand/rubaya-wordmark.png'))
  await wordmark('#FFFFFF', path.join(root, 'brand/rubaya-wordmark-light.png'))

  /** @param {number} size @param {string} file */
  const icon = async (size, file) => {
    const c = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
    const q = await c.newPage()
    await q.setContent(page(`<div style="width:${size}px;height:${size}px;background:${INK};border-radius:${Math.round(size * 0.22)}px;display:grid;place-items:center;color:${GOLD};font:700 ${Math.round(size * 0.68)}px/1 'Playfair Display';padding-bottom:${Math.round(size * 0.04)}px;box-sizing:border-box">R</div>`))
    await q.evaluate(() => document.fonts.ready)
    await q.screenshot({ path: file, omitBackground: true })
    await c.close()
  }
  for (const dir of ['apps/storefront/public', 'apps/admin/public']) {
    mkdirSync(path.join(root, dir), { recursive: true })
    writeFileSync(path.join(root, dir, 'favicon.svg'), faviconSvg)
    await icon(180, path.join(root, dir, 'apple-touch-icon.png'))
  }
  await icon(512, path.join(root, 'brand/rubaya-icon-512.png'))
} finally {
  await browser.close()
}
console.log('brand files written')
