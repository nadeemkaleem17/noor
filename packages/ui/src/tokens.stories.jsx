import { cn } from './cn'

const colors = /** @type {const} */ ([
  'bg', 'surface', 'surface-2', 'fg', 'fg-soft', 'muted', 'line', 'line-strong', 'accent', 'on-accent', 'accent-text', 'accent-soft',
  'sale', 'success', 'success-soft', 'warning', 'warning-soft', 'danger', 'danger-soft', 'focus',
])

const meta = /** @satisfies {import('@storybook/react-vite').Meta} */ ({ title: 'Foundations/Tokens' })
export default meta
/**
 * @typedef {import('@storybook/react-vite').StoryObj<typeof meta>} Story
 */

/** Every semantic color. Switch brand, scheme and direction in the toolbar; contrast is enforced by test/contrast.test.ts. */
export const Colors = /** @type {Story} */ ({
  render: () => (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {colors.map((name) => (
        <div key={name} className="rounded-card border border-line bg-surface p-3 shadow-card">
          <div className="h-12 rounded-control border border-line" style={{ background: `var(--sem-${name})` }} />
          <p className="mt-2 text-sm text-fg">{name}</p>
          <p className="font-mono text-xs text-muted">--sem-{name}</p>
        </div>
      ))}
    </div>
  ),
})

/** Type roles. Resize with the toolbar to check `:lang(ur)` line height and fonts. */
export const Typography = /** @type {Story} */ ({
  render: () => (
    <div className="space-y-3 text-fg">
      <p className="font-heading text-2xl leading-tight">Embroidered lawn three-piece</p>
      <p className="text-md">Body text at 16px. Rs. 6,990 <span className="text-sale">Sale</span> <span className="text-muted">was Rs. 8,490</span></p>
      <p className="text-base text-fg-soft">Admin body at 14px: secondary text uses fg-soft.</p>
      <p className="font-mono text-sm text-muted">RB-10458 · LWN-3P-TEAL-M</p>
      <p className="font-heading text-lg">لان کا کڑھائی والا تین پیس سوٹ</p>
    </div>
  ),
})

/** Utilities that must flip in right-to-left: spacing and alignment use start/end. */
export const Direction = /** @type {Story} */ ({
  render: () => (
    <div className={cn('flex items-center gap-3 rounded-card border border-line bg-surface p-3')}>
      <span className="rounded-control bg-accent px-3 py-1 text-on-accent">Start</span>
      <span className="ms-auto text-fg">The margin before this text is on the inline-start side</span>
    </div>
  ),
})
