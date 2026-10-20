import { TriangleAlert } from 'lucide-react'
import { backgroundNotice, useBackgroundStatus } from '@/lib/background'

/** A strip under the environment note when the server's background worker is not doing its work (see `lib/background.js`). Nothing at all while all is well. */
export function BackgroundBanner() {
  const notice = backgroundNotice(useBackgroundStatus())
  if (!notice) return null
  return (
    <p role="alert" className={`flex items-start justify-center gap-2 px-4 py-2 text-center text-sm ${notice.tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'}`}>
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{notice.text}</span>
    </p>
  )
}
