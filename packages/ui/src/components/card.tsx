import { useRender } from '@base-ui/react/use-render'
import type { ComponentProps } from 'react'
import { cn } from '../cn'

const paddings = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' } as const

export type CardProps = ComponentProps<'div'> & { padding?: keyof typeof paddings; render?: useRender.RenderProp }

/** A bordered surface. Use `render` to make it another element (`<Card render={<section />}>`). */
export function Card({ padding = 'md', className, render, ref, ...props }: CardProps) {
  return useRender({
    defaultTagName: 'div',
    render,
    ref,
    props: { className: cn('rounded-card border border-line bg-surface text-fg shadow-card', paddings[padding], className), ...props },
  })
}
