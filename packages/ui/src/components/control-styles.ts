// Shared look of every text-like control (Input, Textarea, NativeSelect, NumberInput, Select trigger).
export const controlSizes = {
  sm: 'h-9 text-sm',
  md: 'h-11 text-md',
  lg: 'h-13 text-md',
} as const

export type ControlSize = keyof typeof controlSizes

/** No `size`: height and text size come from the brand (`--control-h`, `--control-text`). */
export const controlHeight = (size?: ControlSize): string => (size ? controlSizes[size] : 'h-(--control-h) text-(length:--control-text)')

export const controlBase =
  'w-full rounded-control border border-line-strong bg-surface px-3 text-fg placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger data-[invalid]:border-danger'
