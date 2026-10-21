import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge must know our token names, or it guesses: it would treat `text-md` (a font size) as a color
// and drop one of `text-md text-fg`. Keep these lists in step with tokens.css.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: ['bg', 'surface', 'surface-2', 'fg', 'fg-soft', 'muted', 'line', 'line-strong', 'accent', 'on-accent', 'accent-text', 'accent-soft', 'accent-hover',
        'sale', 'success', 'success-soft', 'warning', 'warning-soft', 'danger', 'danger-soft', 'focus', 'sidebar', 'sidebar-fg', 'sidebar-muted', 'sidebar-active'],
      // the storefront's scale (app.css) is listed too: a component that uses `text-caption` next to a `text-surface` would otherwise lose the size
      text: ['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', 'display', 'h1', 'h2', 'h3', 'h4', 'body', 'ui', 'small', 'caption', 'label'],
      radius: ['control', 'card', 'media', 'sheet'],
      shadow: ['card', 'pop', 'modal', 'float'],
      font: ['heading', 'body', 'mono'],
      leading: ['tight', 'normal', 'urdu'],
    },
    classGroups: {
      z: [{ z: ['base', 'sticky', 'drawer', 'modal', 'popover', 'toast'] }],
    },
  },
})

/**
 * Class names with later Tailwind utilities winning over earlier conflicting ones.
 * @param {...import('clsx').ClassValue} inputs
 * @returns {string}
 */
export const cn = (...inputs) => twMerge(clsx(inputs))
