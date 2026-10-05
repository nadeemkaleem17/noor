/**
 * One `<h1>` per screen, an optional description and the screen's actions at the inline end (plan/07-admin/01 section 4).
 * @param {{ title: string; description?: import('react').ReactNode; actions?: import('react').ReactNode; }} props
 */
export function PageHeader({ title, description, actions }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-semibold">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
