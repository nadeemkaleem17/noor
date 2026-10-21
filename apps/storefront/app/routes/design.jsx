import { Tag } from '@noor/ui/badge'
import { Button } from '@noor/ui/button'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { Price } from '@noor/ui/price'
import { cacheControl } from '~/lib/cache'
import { getEnv } from '~/lib/env.server'
import { isProductionHost } from '~/lib/seo'

// The specimen page (plan/06-storefront/15-design-system-v2.md section 9): every colour, type style, button and form state in one place, for review and for the visual baselines.
// It is only there away from rubaya.pk: on the live shop it is an ordinary 404.
export const headers = /** @type {import('./+types/design').Route.HeadersFunction} */ (() => ({ 'Cache-Control': cacheControl.private }))

export function loader() {
  if (isProductionHost(getEnv().PUBLIC_SITE_URL)) throw new Response('Not Found', { status: 404 })
  return null
}

export const meta = /** @type {import('./+types/design').Route.MetaFunction} */ (() => [{ title: 'Design specimen' }, { name: 'robots', content: 'noindex,nofollow' }])

// the class names are written out so the stylesheet is built with them: a colour class that is not a token does nothing
const colours = [
  ['bg', 'bg-bg'], ['surface', 'bg-surface'], ['surface-2', 'bg-surface-2'], ['fg', 'bg-fg'], ['accent', 'bg-accent'], ['accent-soft', 'bg-accent-soft'],
  ['line', 'bg-line'], ['line-strong', 'bg-line-strong'], ['sale', 'bg-sale'], ['success', 'bg-success'], ['warning', 'bg-warning'], ['danger', 'bg-danger'],
]
const type = [
  ['display', 'text-display font-heading', 'Hero headline'], ['h1', 'text-h1 font-heading', 'Page title'], ['h2', 'text-h2 font-heading', 'Section title'], ['h3', 'text-h3', 'Group title'],
  ['h4', 'text-h4 font-semibold', 'Sub-heading'], ['body', 'text-body', 'Body text for descriptions and policies, up to seventy characters wide.'], ['ui', 'text-ui font-medium', 'Product name, button, form value'],
  ['small', 'text-small', 'Secondary and helper text'], ['caption', 'text-caption', 'Fabric line, badge, legal'], ['label', 'text-label uppercase', 'Navigation and filter title'],
]
const motion = [['--dur-fast', '100 ms', 'colour, underline, focus'], ['--dur-base', '200 ms', 'hover, small panels, accordions'], ['--dur-slow', '300 ms', 'drawers, sheets, picture crossfade'], ['--dur-page', '250 ms', 'page transition'], ['--dur-image', '400 ms', 'a second picture fading in'], ['--dur-reveal', '600 ms', 'editorial blocks and headlines']]

export default function Design() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-8">
      <h1 className="font-heading text-h1">Design specimen</h1>

      <section aria-labelledby="d-colour" className="flex flex-col gap-4">
        <h2 id="d-colour" className="font-heading text-h2">Colour</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {colours.map(([name, cls]) => (
            <li key={name} className="flex flex-col gap-1">
              <span className={`h-16 rounded-control border border-line ${cls}`} />
              <span className="text-small">{name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="d-type" className="flex flex-col gap-4">
        <h2 id="d-type" className="font-heading text-h2">Type</h2>
        <ul className="flex flex-col gap-4">
          {type.map(([name, cls, sample]) => (
            <li key={name} className="grid gap-1 border-b border-line pb-3 md:grid-cols-[6rem_minmax(0,1fr)]">
              <span className="text-small text-muted">{name}</span>
              <span className={cls}>{sample}</span>
            </li>
          ))}
        </ul>
        <p className="flex items-baseline gap-4"><Price money={{ amount: 699000, currency: 'PKR' }} compareAt={{ amount: 849000, currency: 'PKR' }} size="lg" /><span className="text-small text-muted">price, sale price and the old price</span></p>
      </section>

      <section aria-labelledby="d-buttons" className="flex flex-col gap-4">
        <h2 id="d-buttons" className="font-heading text-h2">Buttons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Text button</Button>
          <Button disabled>Disabled</Button>
          <Button loading>Loading</Button>
        </div>
        <p className="text-small text-muted">Hover and press each one: the primary lifts and settles, the secondary darkens its edge, the text button's underline firms up.</p>
      </section>

      <section aria-labelledby="d-tags" className="flex flex-col gap-4">
        <h2 id="d-tags" className="font-heading text-h2">Eyebrow and merchandising tags</h2>
        <p className="eyebrow">New arrivals</p>
        <ul className="flex flex-wrap items-center gap-3">
          <li><Tag tone="ink">New</Tag></li>
          <li><Tag tone="sale">-20%</Tag></li>
          <li><Tag tone="paper">Bestseller</Tag></li>
          <li><Tag tone="quiet">Sold out</Tag></li>
        </ul>
      </section>

      <section aria-labelledby="d-shape" className="flex flex-col gap-4">
        <h2 id="d-shape" className="font-heading text-h2">Shape, depth and space</h2>
        <ul className="grid grid-cols-2 gap-4 text-small md:grid-cols-4">
          <li className="flex h-20 items-center justify-center rounded-media bg-surface-2">media</li>
          <li className="flex h-20 items-center justify-center rounded-card border border-line bg-surface">card</li>
          <li className="flex h-20 items-center justify-center rounded-sheet bg-surface shadow-pop">sheet, floating</li>
          <li className="flex h-20 items-center justify-center rounded-full bg-accent text-on-accent shadow-float">float</li>
        </ul>
        <p className="text-small text-muted">Gutter, block and section space: the three bars below are the page edge, an editorial block and a major section at this width.</p>
        <div className="flex items-end gap-4">
          <span className="h-gutter w-24 bg-line" /><span className="h-block w-24 bg-line-strong" /><span className="h-section w-24 bg-fg" />
        </div>
      </section>

      <section aria-labelledby="d-forms" className="flex flex-col gap-4">
        <h2 id="d-forms" className="font-heading text-h2">Form fields</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Full name" hint="As on your CNIC"><Input defaultValue="Ayesha Khan" /></Field>
          <Field label="Mobile number" error="Enter a Pakistani mobile number, for example 0300 1234567"><Input defaultValue="03001" /></Field>
        </div>
      </section>

      <section aria-labelledby="d-motion" className="flex flex-col gap-4">
        <h2 id="d-motion" className="font-heading text-h2">Motion</h2>
        <ul className="flex flex-col gap-1 text-small">
          {motion.map(([token, ms, use]) => (
            <li key={token}><code>{token}</code>: {ms}, {use}</li>
          ))}
        </ul>
        <p className="text-small text-muted">With reduced motion on, every duration is 0.</p>
      </section>
    </div>
  )
}
