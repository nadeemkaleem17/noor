import type { ComponentProps } from 'react'
import { cn } from '../cn'

/** Styling only: a scrolling wrapper, a sticky header and row hover. Sorting, selection and paging belong to the admin DataTable. */
export function Table({ className, label, ...props }: ComponentProps<'table'> & { label?: string }) {
  return (
    // focusable so a keyboard user can scroll a wide table; named when `label` is given
    <div tabIndex={0} role={label ? 'region' : undefined} aria-label={label} className="overflow-x-auto">
      <table
        className={cn('w-full border-collapse text-start text-(length:--control-text)', '[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-sticky [&_tbody_tr:hover]:bg-surface-2', className)}
        {...props}
      />
    </div>
  )
}

type CellProps = { numeric?: boolean }

export function Th({ numeric, className, ...props }: ComponentProps<'th'> & CellProps) {
  return <th scope="col" className={cn('border-b border-line-strong bg-surface px-3 py-2 text-sm font-medium text-fg-soft', numeric ? 'text-end' : 'text-start', className)} {...props} />
}

/** `numeric` right-aligns (end-aligns) and uses tabular figures so amounts line up. */
export function Td({ numeric, className, ...props }: ComponentProps<'td'> & CellProps) {
  return <td className={cn('border-b border-line px-3 py-2', numeric ? 'text-end tabular-nums' : 'text-start', className)} {...props} />
}
