import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'

const sizes = { sm: 'size-4', md: 'size-5', lg: 'size-8' } as const

type Props = { size?: keyof typeof sizes; label?: string; className?: string; decorative?: boolean }

/** A status region with a visually hidden label. `decorative` drops the role for spinners inside something that already says it is busy (a loading Button). */
export function Spinner({ size = 'md', label, className, decorative }: Props) {
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
