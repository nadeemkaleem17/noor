import { EmptyState } from '@noor/ui/empty-state'
import { useMatches } from 'react-router'
import { PageHeader } from '@/components/page-header'

/** Placeholder for a screen that a later task rebuilds. It has its heading, so the shell, sidebar and permissions can be tried end to end. */
export function Component() {
  const title = /** @type {{ title?: string; } | undefined} */ (useMatches().at(-1)?.handle)?.title ?? 'This page'
  return (
    <>
      <PageHeader title={title} />
      <EmptyState title="Not rebuilt yet" body="This screen is replaced by the new admin in a later step of milestone M3." />
    </>
  )
}
