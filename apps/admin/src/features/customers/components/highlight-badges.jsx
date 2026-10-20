/** Black or white, whichever reads better on this colour (the two contrast equally at a relative luminance of 0.179). @param {string} hex `#rrggbb` */
export function inkOn(hex) {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#000000' : '#ffffff'
}

/**
 * The colours a customer has earned, as chips that say their name (the colour alone never carries the meaning).
 * @param {{ highlights: import('@noor/contract').CustomerHighlight[] }} props
 */
export function HighlightBadges({ highlights }) {
  if (!highlights.length) return null
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {highlights.map((h) => (
        <span key={h.ruleId} className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: h.color, color: inkOn(h.color) }}>
          {h.label}
        </span>
      ))}
    </span>
  )
}
