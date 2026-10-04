import type { ReactNode } from 'react'

/** Keeps order numbers, SKUs, phone numbers and prices left-to-right inside right-to-left text. */
export function Ltr({ children }: { children: ReactNode }) {
  return <bdi dir="ltr">{children}</bdi>
}
