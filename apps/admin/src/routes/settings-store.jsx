import { HistoryPanel } from '@/components/history-panel'
import { StorePage } from '@/features/settings/components/store-page'

export function Component() {
  return (
    <>
      <StorePage />
      <HistoryPanel entityType="settings" entityId="store" />
    </>
  )
}
