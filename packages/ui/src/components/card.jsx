import { useRender } from '@base-ui/react/use-render'
import { cn } from '../cn'

const paddings = /** @type {const} */ ({ none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' })

/**
 * @typedef {import('react').ComponentProps<'div'> & { padding?: keyof typeof paddings; render?: useRender.RenderProp; }} CardProps
 */

/**
 * A bordered surface. Use `render` to make it another element (`<Card render={<section />}>`).
 * @param {CardProps} props
 */
export function Card({ padding = 'md', className, render, ref, ...props }) {
  return useRender({
    defaultTagName: 'div',
    render,
    ref,
    props: { className: cn('rounded-card border border-line bg-surface text-fg shadow-card', paddings[padding], className), ...props },
  })
}
