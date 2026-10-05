import { encode } from 'uqr'

/** A QR code drawn as SVG paths (no HTML injection). Dark on white, with the quiet zone a scanner needs. @param {{ value: string; label: string; }} props */
export function QrCode({ value, label }) {
  const { size, data } = encode(value, { border: 0 })
  const border = 4
  const path = data.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x + border},${y + border}h1v1h-1z` : ''))).join('')
  const total = size + border * 2
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${total} ${total}`} className="size-40 rounded-control bg-white" shapeRendering="crispEdges">
      <path d={path} fill="#000" />
    </svg>
  )
}
