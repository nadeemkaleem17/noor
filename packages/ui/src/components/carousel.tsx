import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'

type Props<T> = {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  /** Accessible name of the whole carousel. */
  label: string
  /** Advance every this many milliseconds. Pauses on hover, focus and reduced motion; a visible pause button is shown. */
  autoPlayMs?: number
  className?: string
}

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'
const subscribeReducedMotion = (cb: () => void) => {
  const mq = window.matchMedia(reducedMotionQuery)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

/** CSS scroll-snap track. Buttons and the Left and Right arrow keys move one slide; they follow the page direction. */
export function Carousel<T>({ items, renderItem, label, autoPlayMs, className }: Props<T>) {
  const { t } = useTranslation()
  const track = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(reducedMotionQuery).matches, () => false)

  // the app sets `dir` on <html> (or a wrapper), so the nearest `dir` attribute is the page direction
  const isRtl = () => track.current?.closest('[dir]')?.getAttribute('dir') === 'rtl'
  /** `forward` is toward the end of the content: right in LTR, left in RTL. */
  const move = (forward: boolean, wrap = false) => {
    const el = track.current
    if (!el) return
    const atEnd = Math.abs(el.scrollLeft) + el.clientWidth >= el.scrollWidth - 1
    if (forward && atEnd && wrap) return el.scrollTo({ left: 0, behavior: reducedMotion ? 'auto' : 'smooth' }) // physical: scroll offsets are physical in the DOM, negative in RTL
    const sign = (forward ? 1 : -1) * (isRtl() ? -1 : 1)
    el.scrollBy({ left: sign * el.clientWidth, behavior: reducedMotion ? 'auto' : 'smooth' }) // physical: same
  }

  const playing = Boolean(autoPlayMs) && !reducedMotion && !paused && !hovered && !focused
  useEffect(() => {
    if (!playing || !autoPlayMs) return
    const id = setInterval(() => move(true, true), autoPlayMs)
    return () => clearInterval(id)
  })

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    move((e.key === 'ArrowRight') !== isRtl())
  }

  const arrow = 'absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-fg shadow-card hover:bg-surface'
  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className={cn('relative', className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <div ref={track} tabIndex={0} onKeyDown={onKeyDown} aria-live={playing ? 'off' : 'polite'} className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] motion-reduce:scroll-auto">
        {items.map((item, i) => (
          <div key={i} role="group" aria-roledescription="slide" aria-label={t('slideOf', { n: i + 1, total: items.length })} className="w-full shrink-0 snap-start">
            {renderItem(item, i)}
          </div>
        ))}
      </div>
      {items.length > 1 ? (
        <>
          <button type="button" aria-label={t('previousSlide')} onClick={() => move(false)} className={cn(arrow, 'start-2')}>
            <ChevronLeft aria-hidden className="size-5 rtl:-scale-x-100" />
          </button>
          <button type="button" aria-label={t('nextSlide')} onClick={() => move(true)} className={cn(arrow, 'end-2')}>
            <ChevronRight aria-hidden className="size-5 rtl:-scale-x-100" />
          </button>
        </>
      ) : null}
      {autoPlayMs ? (
        <button type="button" aria-label={paused ? t('play') : t('pause')} onClick={() => setPaused(!paused)} className="absolute bottom-2 end-2 flex size-9 items-center justify-center rounded-full bg-surface/90 text-fg shadow-card">
          {paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
        </button>
      ) : null}
    </section>
  )
}
