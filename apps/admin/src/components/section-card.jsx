import { Card } from '@noor/ui/card'

/** A titled block of a long form. The `id` is the anchor of the in-page section list. @param {{ id: string; title: string; description?: string; children: import('react').ReactNode; }} props */
export function SectionCard({ id, title, description, children }) {
  return (
    <Card render={<section id={id} aria-labelledby={`${id}-title`} />} padding="lg" className="scroll-mt-20 space-y-4">
      <header>
        <h2 id={`${id}-title`} className="font-heading text-lg font-semibold">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </header>
      {children}
    </Card>
  )
}
