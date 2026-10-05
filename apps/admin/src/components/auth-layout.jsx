import { Card } from '@noor/ui/card'

/**
 * The sign-in screens: a centred 400 px card, no sidebar (plan/07-admin/01 section 5).
 * @param {{ title: string; description?: import('react').ReactNode; children: import('react').ReactNode; footer?: import('react').ReactNode; }} props
 */
export function AuthLayout({ title, description, children, footer }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-4">
      <div className="w-full max-w-[25rem]">
        <p className="mb-4 text-center font-heading text-xl font-semibold tracking-wide text-accent-text">RUBAYA</p>
        <Card padding="lg" render={<section />} className="space-y-4">
          <header className="space-y-1">
            <h1 className="font-heading text-xl font-semibold">{title}</h1>
            {description ? <p className="text-sm text-muted">{description}</p> : null}
          </header>
          {children}
        </Card>
        {footer ? <p className="mt-4 text-center text-sm text-muted">{footer}</p> : null}
      </div>
    </main>
  )
}
