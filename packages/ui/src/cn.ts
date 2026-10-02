import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge must know our token names, or it guesses: it would treat `text-md` (a font size) as a color
// and drop one of `text-md text-fg`. Keep these lists in step with tokens.css.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: ['bg', 'surface', 'surface-2', 'fg', 'fg-soft', 'muted', 'line', 'line-strong', 'accent', 'on-accent', 'accent-text', 'accent-soft',
        'sale', 'success', 'success-soft', 'warning', 'warning-soft', 'danger', 'danger-soft', 'focus', 'sidebar', 'sidebar-fg', 'sidebar-muted', 'sidebar-active'],
      text: ['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl'],
      radius: ['control', 'card', 'media'],
      shadow: ['card', 'pop', 'modal'],
      font: ['heading', 'body', 'mono'],
      leading: ['tight', 'normal', 'urdu'],
    },
    classGroups: {
      z: [{ z: ['base', 'sticky', 'drawer', 'modal', 'popover', 'toast'] }],
    },
  },
})

/** Class names with later Tailwind utilities winning over earlier conflicting ones. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))
