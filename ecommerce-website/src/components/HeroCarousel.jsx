import { useEffect, useRef, useState } from 'react'
import CtaLink from './CtaLink'

const INTERVAL_MS = 6000

// Hero slides from the store settings (already filtered + sorted by StoreConfigProvider).
// Auto-advances, but pauses while hovered/focused, and never auto-plays for users who
// prefer reduced motion.
export default function HeroCarousel({ slides }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
  const count = slides.length
  const current = Math.min(index, count - 1) // slides can shrink between renders

  useEffect(() => {
    if (count < 2 || paused || reducedMotion.current) return
    const id = setInterval(() => setIndex((i) => (i + 1) % count), INTERVAL_MS)
    return () => clearInterval(id)
  }, [count, paused])

  if (!count) return null
  const go = (i) => setIndex((i + count) % count)

  return (
    <section
      className="hero-carousel"
      aria-roledescription="carousel"
      aria-label="Featured"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false) }}
    >
      <div className="hc-track">
        {slides.map((s, i) => (
          <div
            key={`${s.sortOrder}-${i}`}
            className={'hc-slide' + (i === current ? ' active' : '')}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== current}
            inert={i !== current ? true : undefined}
          >
            <img className="hc-img" src={s.imageUrl} alt="" loading={i === 0 ? 'eager' : 'lazy'} />
            <div className="hc-copy">
              <h1>{s.heading}</h1>
              {s.subheading && <p>{s.subheading}</p>}
              <CtaLink text={s.buttonText} href={s.buttonLink} />
            </div>
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button type="button" className="hc-nav prev" onClick={() => go(current - 1)} aria-label="Previous slide">‹</button>
          <button type="button" className="hc-nav next" onClick={() => go(current + 1)} aria-label="Next slide">›</button>
          <div className="hc-dots">
            {slides.map((s, i) => (
              <button
                type="button"
                key={`dot-${i}`}
                className={'hc-dot' + (i === current ? ' active' : '')}
                onClick={() => go(i)}
                aria-label={`Show slide ${i + 1}: ${s.heading}`}
                aria-current={i === current}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
