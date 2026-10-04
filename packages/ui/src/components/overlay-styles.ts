// Shared look of overlays and popups.
export const backdrop =
  'fixed inset-0 z-modal bg-fg/40 transition-opacity duration-(--dur-modal) data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 data-[ending-style]:duration-(--dur-modal-close)'

export const modalSurface = 'z-modal border border-line bg-surface text-fg shadow-modal outline-none'

/** Menu, Select, Combobox and Popover panels. */
export const floating = 'z-popover rounded-card border border-line bg-surface p-1 text-fg shadow-pop outline-none'

export const listItem =
  'flex cursor-default items-center gap-2 rounded-control px-3 py-1.5 text-(length:--control-text) outline-none select-none data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
