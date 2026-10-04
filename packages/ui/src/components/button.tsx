import { useRender } from '@base-ui/react/use-render'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../cn'
import { isExternal, safeHref } from '../safe-href'
import { Spinner } from './spinner'

const variants = {
  primary: 'bg-accent text-on-accent hover:brightness-95 active:brightness-90',
  secondary: 'bg-surface text-fg border border-line-strong hover:bg-surface-2',
  ghost: 'text-fg hover:bg-surface-2',
  danger: 'bg-danger text-surface hover:brightness-95 active:brightness-90',
  link: 'text-accent-text underline underline-offset-4 h-auto px-0',
} as const
const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-md', lg: 'h-13 px-6 text-md' } as const
const iconSizes = { sm: 'size-9', md: 'size-11', lg: 'size-13' } as const

type Visual = {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  loading?: boolean
  iconStart?: ReactNode
  iconEnd?: ReactNode
  fullWidth?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors duration-(--dur-micro) disabled:opacity-50 disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none'

function classes({ variant = 'primary', size, fullWidth, className }: Visual & { className?: string }) {
  // No size prop: height and text come from the brand (36 px admin, 44 px storefront)
  return cn(base, variants[variant], variant !== 'link' && (size ? sizes[size] : 'h-(--control-h) px-4 text-(length:--control-text)'), fullWidth && 'w-full', className)
}

function content({ loading, iconStart, iconEnd, children }: Visual & { children?: ReactNode }) {
  return (
    <>
      {loading ? <Spinner size="sm" decorative /> : iconStart}
      {children}
      {iconEnd}
    </>
  )
}

export type ButtonProps = ComponentProps<'button'> & Visual & { render?: useRender.RenderProp }

export function Button({ variant, size, loading, iconStart, iconEnd, fullWidth, className, children, disabled, type = 'button', render, ref, ...props }: ButtonProps) {
  const inert = disabled || loading
  return useRender({
    defaultTagName: 'button',
    render,
    ref,
    props: {
      // a rendered link has no `disabled`, so it gets aria-disabled and loses pointer events instead
      ...(render ? { 'aria-disabled': inert || undefined } : { type, disabled: inert }),
      'aria-busy': loading || undefined,
      className: classes({ variant, size, fullWidth, className }),
      children: content({ loading, iconStart, iconEnd, children }),
      ...props,
    },
  })
}

export type IconButtonProps = Omit<ButtonProps, 'children' | 'iconStart' | 'iconEnd' | 'fullWidth' | 'aria-label'> & { label: string; icon: ReactNode }

/** Square icon-only button. `label` is required: it is the accessible name. ponytail: Tooltip with the same text arrives with M2-02. */
export function IconButton({ label, icon, variant = 'ghost', size = 'md', className, loading, ...props }: IconButtonProps) {
  return (
    <Button
      aria-label={label}
      title={label}
      variant={variant}
      size={size}
      loading={loading}
      className={cn('px-0', iconSizes[size], className)}
      {...props}
    >
      {loading ? null : icon}
    </Button>
  )
}

export type LinkButtonProps = Omit<ComponentProps<'a'>, 'href'> & Omit<Visual, 'loading'> & { href: string; render?: useRender.RenderProp }

/** A link that looks like a Button. Pass the app's router link as `render`. An href with an unsafe scheme renders nothing. */
export function LinkButton({ href, variant, size, iconStart, iconEnd, fullWidth, className, children, render, ref, ...props }: LinkButtonProps) {
  const safe = safeHref(href)
  return useRender({
    defaultTagName: 'a',
    render,
    ref,
    enabled: safe !== undefined,
    props: {
      href: safe,
      rel: safe && isExternal(safe) ? 'noopener noreferrer' : undefined,
      className: classes({ variant, size, fullWidth, className }),
      children: content({ iconStart, iconEnd, children }),
      ...props,
    },
  })
}
