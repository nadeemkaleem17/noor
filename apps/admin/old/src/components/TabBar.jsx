import { useLayoutEffect, useRef, useState } from 'react'

export function TabBar({ items, activeKey, onChange, style, trailing }) {
  const containerRef = useRef(null)
  const [indicator, setIndicator] = useState(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    const active = container?.querySelector(`[data-tab-key="${CSS.escape(String(activeKey))}"]`)
    if (active && container) {
      const cRect = container.getBoundingClientRect()
      const aRect = active.getBoundingClientRect()
      setIndicator({ left: aRect.left - cRect.left, width: aRect.width })
    }
  }, [activeKey, items])

  return (
    <div className="tabs" ref={containerRef} style={style}>
      {items.map((it) => (
        <button
          key={it.key}
          data-tab-key={it.key}
          className={`tab${activeKey === it.key ? ' active' : ''}`}
          onClick={() => onChange(it.key)}
        >
          {it.label}
        </button>
      ))}
      {indicator && (
        <span
          className="tab-indicator"
          style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
        />
      )}
      {trailing}
    </div>
  )
}