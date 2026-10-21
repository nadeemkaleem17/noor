// Shared look of every text-like control (Input, Textarea, NativeSelect, NumberInput, Select trigger).
export const controlSizes = /** @type {const} */ ({
  sm: 'h-9 text-sm',
  md: 'h-11 text-md',
  lg: 'h-13 text-md',
})

/**
 * @typedef {keyof typeof controlSizes} ControlSize
 */

/**
 * No `size`: height and text size come from the brand (`--control-h`, `--control-text`).
 * @param {ControlSize} [size]
 * @returns {string}
 */
export const controlHeight = (size) => (size ? controlSizes[size] : 'h-(--control-h) text-(length:--control-text)')

export const controlBase =
  'w-full rounded-control border border-line-strong bg-surface px-3 text-fg transition-colors duration-(--dur-micro) ease-standard placeholder:text-muted hover:border-fg disabled:cursor-not-allowed disabled:hover:border-line-strong disabled:opacity-50 aria-invalid:border-danger data-[invalid]:border-danger'
