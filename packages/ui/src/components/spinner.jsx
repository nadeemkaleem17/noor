import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'

const sizes = /** @type {const} */ ({ sm: 'size-4', md: 'size-5', lg: 'size-8' })

/**
 * @typedef {object} Props
 * @property {keyof typeof sizes} [size]
 * @property {string} [label]
 * @property {string} [className]
 * @property {boolean} [decorative]
 */

/**
 * A status region with a visually hidden label. `decorative` drops the role for spinners inside something that already says it is busy (a loading Button).
 * @param {Props} props
 */
export function Spinner({ size = 'md', label, className, decorative }) {
  const { t } = useTranslation()
  const icon = <LoaderCircle aria-hidden className={cn(sizes[size], 'animate-spin motion-reduce:animate-none', className)} />
  if (decorative) return icon
  return (
    <span role="status" className="inline-flex">
      {icon}
      <span className="sr-only">{label ?? t('loading')}</span>
    </span>
  )
}
